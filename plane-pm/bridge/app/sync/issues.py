"""Bidirectional issue sync: GitLab issue <-> Plane work item.

Auto-creation is GitLab->Plane only (configurable). Once a pair is linked,
edits/closes propagate both ways. The neutral content hash plus the bot-actor
check (applied at the router) prevent the write-echo-write loop.
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlmodel import Session, select

from ..clients.gitlab import get_gitlab_client
from ..clients.plane import get_plane_client
from ..config import get_settings
from ..models import IssueLink, utcnow
from . import mappings
from .dedupe import (
    NeutralIssue,
    hash_neutral,
    html_to_md,
    md_to_html,
    normalize_labels,
    normalize_ws,
    plain_from_markdown,
)

log = logging.getLogger("bridge.issues")


def _gitlab_label_names(payload: dict) -> list[str]:
    return [l.get("title") or l.get("name") for l in payload.get("labels", []) if l]


async def handle_gitlab_issue(session: Session, payload: dict) -> str:
    settings = get_settings()
    mapping = mappings.mapping_by_gitlab(session, (payload.get("project") or {}).get("id"))
    if not mapping or not mapping.active:
        return "ignored"
    cfg = mappings.config_by_gitlab(mapping.gitlab_project_id)

    obj = payload.get("object_attributes") or {}
    iid = obj.get("iid")
    action = obj.get("action")
    if iid is None:
        return "ignored"

    link = session.exec(
        select(IssueLink).where(
            IssueLink.project_mapping_id == mapping.id,
            IssueLink.gitlab_issue_iid == iid,
        )
    ).first()

    title = obj.get("title") or "(untitled)"
    body_md = obj.get("description") or ""
    closed = obj.get("state") == "closed"
    label_names = _gitlab_label_names(payload)
    target_date = obj.get("due_date") or None

    neutral = NeutralIssue(
        title=normalize_ws(title),
        body=plain_from_markdown(body_md),
        closed=closed,
        labels=normalize_labels(label_names),
        target_date=target_date,
    )
    h = hash_neutral(neutral)
    if link and link.last_synced_hash == h:
        return "skipped_echo"

    pc = get_plane_client()
    fields: dict = {}
    if settings.sync_title:
        fields["name"] = title
    if settings.sync_description:
        fields["description_html"] = md_to_html(body_md)
    if settings.sync_dates and target_date:
        fields["target_date"] = target_date
    if settings.sync_labels and (cfg.label_sync if cfg else True) and label_names:
        fields["labels"] = await mappings.resolve_label_ids(
            session, pc, mapping.plane_project_id, label_names
        )
    if settings.sync_state and action in ("close", "reopen"):
        group = "completed" if action == "close" else "unstarted"
        configured = cfg.state_group_map.get(group) if cfg else None
        state_id = await mappings.resolve_state_id(
            session, pc, mapping.plane_project_id, group, configured
        )
        if state_id:
            fields["state"] = state_id

    if link is None:
        if action in ("open", "reopen", "update") and settings.create_missing_plane_issue:
            fields.setdefault("name", title)
            created = await pc.create_issue(mapping.plane_project_id, fields)
            link = IssueLink(
                project_mapping_id=mapping.id,
                gitlab_issue_iid=iid,
                plane_work_item_id=created["id"],
                plane_sequence_id=created.get("sequence_id"),
                origin="gitlab",
            )
            session.add(link)
            log.info("created Plane work item %s from GitLab issue #%s", created.get("sequence_id"), iid)
        else:
            return "ignored"
    else:
        await pc.update_issue(mapping.plane_project_id, link.plane_work_item_id, fields)
        log.info("updated Plane work item for GitLab issue #%s", iid)

    link.last_synced_hash = h
    link.last_synced_at = utcnow()
    session.add(link)
    session.commit()
    return "done"


async def handle_plane_issue(session: Session, payload: dict) -> str:
    settings = get_settings()
    data = payload.get("data") or {}
    action = payload.get("action")
    wi_id = data.get("id")
    project_id = data.get("project") or data.get("project_id")
    if not wi_id or not project_id:
        return "ignored"

    mapping = mappings.mapping_by_plane(session, project_id)
    if not mapping or not mapping.active:
        return "ignored"
    cfg = mappings.config_by_plane(project_id)

    link = session.exec(
        select(IssueLink).where(IssueLink.plane_work_item_id == wi_id)
    ).first()

    pc = get_plane_client()
    gc = get_gitlab_client()

    # Deletion: close the counterpart (never hard-delete).
    if action == "deleted":
        if link and settings.delete_behavior == "close":
            await gc.update_issue(mapping.gitlab_project_id, link.gitlab_issue_iid, {"state_event": "close"})
            return "done"
        return "ignored"

    group = await mappings.group_for_state(session, pc, mapping.plane_project_id, data.get("state"))
    closed = group in ("completed", "cancelled")
    title = data.get("name") or "(untitled)"
    if data.get("description_stripped") is not None:
        body_text = normalize_ws(data.get("description_stripped"))
    else:
        from .dedupe import plain_from_html
        body_text = plain_from_html(data.get("description_html"))
    label_names = await mappings.plane_label_names(
        session, pc, mapping.plane_project_id, data.get("labels") or []
    )
    target_date = data.get("target_date") or None

    neutral = NeutralIssue(
        title=normalize_ws(title),
        body=body_text,
        closed=closed,
        labels=normalize_labels(label_names),
        target_date=target_date,
    )
    h = hash_neutral(neutral)
    if link and link.last_synced_hash == h:
        return "skipped_echo"

    if link is None:
        if not settings.create_missing_gitlab_issue:
            return "ignored"  # Plane-origin items stay Plane-only by default
        gl: dict = {"title": title, "description": html_to_md(data.get("description_html"))}
        if settings.sync_labels and label_names:
            gl["labels"] = ",".join(label_names)
        if settings.sync_dates and target_date:
            gl["due_date"] = target_date
        created = await gc.create_issue(mapping.gitlab_project_id, gl)
        link = IssueLink(
            project_mapping_id=mapping.id,
            gitlab_issue_iid=created["iid"],
            plane_work_item_id=wi_id,
            plane_sequence_id=data.get("sequence_id"),
            origin="plane",
        )
        session.add(link)
        log.info("created GitLab issue #%s from Plane work item", created["iid"])
    else:
        gl = {}
        if settings.sync_title:
            gl["title"] = title
        if settings.sync_description:
            gl["description"] = html_to_md(data.get("description_html"))
        if settings.sync_labels:
            gl["labels"] = ",".join(label_names)
        if settings.sync_dates:
            gl["due_date"] = target_date or ""
        if settings.sync_state:
            gl["state_event"] = "close" if closed else "reopen"
        await gc.update_issue(mapping.gitlab_project_id, link.gitlab_issue_iid, gl)
        log.info("updated GitLab issue #%s from Plane work item", link.gitlab_issue_iid)

    link.last_synced_hash = h
    link.plane_updated_at = utcnow()
    session.add(link)
    session.commit()
    return "done"
