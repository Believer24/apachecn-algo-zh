"""MR/commit -> Plane work-item state automation.

Branch names, MR titles/descriptions, and commit messages are scanned for Plane
work-item references (e.g. ``PROJ-123``). Merge-request lifecycle drives the
linked work item's state; commit messages with closing keywords complete it.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from sqlmodel import Session, select

from ..clients.plane import get_plane_client
from ..config import get_settings
from ..models import IssueLink, MRLink, ProjectMapping, utcnow
from . import mappings

log = logging.getLogger("bridge.mr")

_CLOSE_KEYWORDS = re.compile(
    r"(?i)\b(?:clos(?:e|es|ed)|fix(?:e|es|ed)?|resolv(?:e|es|ed))\b"
)


def _mr_group(state: str, action: Optional[str], draft: bool) -> Optional[str]:
    """Map a merge-request lifecycle to a target Plane state group (None = no change)."""
    if state == "merged" or action == "merge":
        return "completed"
    if state == "opened":
        return "unstarted" if draft else "started"
    # closed-without-merge / locked: leave the work item state alone by default.
    return None


async def _find_work_item_id(
    session: Session, pc, mapping: ProjectMapping, seq: int
) -> Optional[str]:
    link = session.exec(
        select(IssueLink).where(
            IssueLink.project_mapping_id == mapping.id,
            IssueLink.plane_sequence_id == seq,
        )
    ).first()
    if link:
        return link.plane_work_item_id
    found = await pc.find_issue_by_sequence(mapping.plane_project_id, seq)
    return found["id"] if found else None


def _references(text: str) -> set[tuple[str, int]]:
    settings = get_settings()
    return {
        (m.group(1).upper(), int(m.group(2)))
        for m in settings.identifier_pattern.finditer(text or "")
    }


async def _apply_state(
    session: Session, pc, mapping: ProjectMapping, wi_id: str, group: str
) -> bool:
    cfg = mappings.config_by_identifier(mapping.plane_project_identifier)
    configured = cfg.state_group_map.get(group) if cfg else None
    state_id = await mappings.resolve_state_id(
        session, pc, mapping.plane_project_id, group, configured
    )
    if not state_id:
        log.warning("no '%s' state in project %s", group, mapping.plane_project_identifier)
        return False
    await pc.update_issue(mapping.plane_project_id, wi_id, {"state": state_id})
    return True


async def handle_gitlab_merge_request(session: Session, payload: dict) -> str:
    obj = payload.get("object_attributes") or {}
    mr_iid = obj.get("iid")
    if mr_iid is None:
        return "ignored"
    state = obj.get("state") or ""
    action = obj.get("action")
    draft = bool(obj.get("work_in_progress") or obj.get("draft"))
    mr_url = obj.get("url") or ""

    text = " ".join(
        [obj.get("source_branch") or "", obj.get("title") or "", obj.get("description") or ""]
    )
    refs = _references(text)
    if not refs:
        return "ignored"

    pc = get_plane_client()
    group = _mr_group(state, action, draft)
    touched = 0
    seen: set[str] = set()

    for identifier, seq in refs:
        mapping = mappings.mapping_by_identifier(session, identifier)
        if not mapping or not mapping.active:
            continue
        wi_id = await _find_work_item_id(session, pc, mapping, seq)
        if not wi_id or wi_id in seen:
            continue
        seen.add(wi_id)

        mrlink = session.exec(
            select(MRLink).where(
                MRLink.project_mapping_id == mapping.id,
                MRLink.gitlab_mr_iid == mr_iid,
                MRLink.plane_work_item_id == wi_id,
            )
        ).first()
        if mrlink is None:
            mrlink = MRLink(
                project_mapping_id=mapping.id, gitlab_mr_iid=mr_iid, plane_work_item_id=wi_id
            )

        if get_settings().sync_state and group:
            if await _apply_state(session, pc, mapping, wi_id, group):
                mrlink.last_applied_state_group = group
                log.info("MR !%s -> %s-%s set to '%s'", mr_iid, identifier, seq, group)

        if not mrlink.commented:
            try:
                await pc.add_comment(
                    mapping.plane_project_id,
                    wi_id,
                    f'Linked GitLab merge request <a href="{mr_url}">!{mr_iid}</a>.',
                )
                mrlink.commented = True
            except Exception as exc:  # backlink comment is best-effort
                log.warning("could not post MR backlink comment: %s", exc)

        mrlink.last_mr_state = state
        mrlink.updated_at = utcnow()
        session.add(mrlink)
        touched += 1

    session.commit()
    return "done" if touched else "ignored"


async def handle_gitlab_push(session: Session, payload: dict) -> str:
    commits = payload.get("commits") or []
    pc = get_plane_client()
    closing: set[tuple[str, int]] = set()

    for commit in commits:
        msg = commit.get("message") or ""
        if _CLOSE_KEYWORDS.search(msg):
            closing |= _references(msg)

    if not closing:
        return "ignored"

    touched = 0
    for identifier, seq in closing:
        mapping = mappings.mapping_by_identifier(session, identifier)
        if not mapping or not mapping.active:
            continue
        wi_id = await _find_work_item_id(session, pc, mapping, seq)
        if not wi_id:
            continue
        if get_settings().sync_state and await _apply_state(
            session, pc, mapping, wi_id, "completed"
        ):
            log.info("commit closes %s-%s -> completed", identifier, seq)
            touched += 1

    return "done" if touched else "ignored"
