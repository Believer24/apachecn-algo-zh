"""Resolution helpers: project mappings, state-group -> state-UUID, labels.

DB ``ProjectMapping`` rows give fast lookups in the webhook path and survive
restarts; the richer ``ProjectConfig`` (state-group overrides, label toggle)
stays in memory, populated from ``projects.yml`` at boot.
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlmodel import Session, select

from ..config import ProjectConfig
from ..models import ProjectMapping, StateCache

log = logging.getLogger("bridge.mappings")

STATE_GROUPS = ("backlog", "unstarted", "started", "completed", "cancelled")

# In-memory ProjectConfig registry (keyed three ways for the different lookups).
_by_gitlab: dict[int, ProjectConfig] = {}
_by_plane: dict[str, ProjectConfig] = {}
_by_identifier: dict[str, ProjectConfig] = {}


def register_project_configs(configs: list[ProjectConfig]) -> None:
    _by_gitlab.clear(); _by_plane.clear(); _by_identifier.clear()
    for c in configs:
        _by_gitlab[c.gitlab_project_id] = c
        _by_plane[c.plane_project_id] = c
        _by_identifier[c.plane_project_identifier] = c


def config_by_gitlab(gitlab_project_id: int) -> Optional[ProjectConfig]:
    return _by_gitlab.get(gitlab_project_id)


def config_by_plane(plane_project_id: str) -> Optional[ProjectConfig]:
    return _by_plane.get(plane_project_id)


def config_by_identifier(identifier: str) -> Optional[ProjectConfig]:
    return _by_identifier.get(identifier.upper())


def upsert_project_mappings(
    session: Session, configs: list[ProjectConfig], default_slug: str
) -> None:
    """Sync projects.yml into the project_mapping table and the in-memory registry."""
    for c in configs:
        slug = c.plane_workspace_slug or default_slug
        row = session.exec(
            select(ProjectMapping).where(ProjectMapping.gitlab_project_id == c.gitlab_project_id)
        ).first()
        if row is None:
            row = ProjectMapping(
                gitlab_project_id=c.gitlab_project_id,
                plane_workspace_slug=slug,
                plane_project_id=c.plane_project_id,
                plane_project_identifier=c.plane_project_identifier,
            )
            session.add(row)
        else:
            row.plane_workspace_slug = slug
            row.plane_project_id = c.plane_project_id
            row.plane_project_identifier = c.plane_project_identifier
            row.active = True
            session.add(row)
    session.commit()
    register_project_configs(configs)


# ---- DB lookups ----
def mapping_by_gitlab(session: Session, gitlab_project_id: int) -> Optional[ProjectMapping]:
    return session.exec(
        select(ProjectMapping).where(ProjectMapping.gitlab_project_id == gitlab_project_id)
    ).first()


def mapping_by_plane(session: Session, plane_project_id: str) -> Optional[ProjectMapping]:
    return session.exec(
        select(ProjectMapping).where(ProjectMapping.plane_project_id == plane_project_id)
    ).first()


def mapping_by_identifier(session: Session, identifier: str) -> Optional[ProjectMapping]:
    return session.exec(
        select(ProjectMapping).where(
            ProjectMapping.plane_project_identifier == identifier.upper()
        )
    ).first()


# ---- state cache ----
async def refresh_state_cache(session: Session, plane_client, plane_project_id: str) -> None:
    states = await plane_client.list_states(plane_project_id)
    for row in session.exec(
        select(StateCache).where(StateCache.plane_project_id == plane_project_id)
    ).all():
        session.delete(row)
    for s in states:
        session.add(
            StateCache(
                plane_project_id=plane_project_id,
                state_id=s["id"],
                name=s.get("name", ""),
                group=s.get("group", ""),
                is_default=bool(s.get("default", False)),
            )
        )
    session.commit()


async def _states_for(session: Session, plane_client, plane_project_id: str) -> list[StateCache]:
    rows = session.exec(
        select(StateCache).where(StateCache.plane_project_id == plane_project_id)
    ).all()
    if not rows:
        await refresh_state_cache(session, plane_client, plane_project_id)
        rows = session.exec(
            select(StateCache).where(StateCache.plane_project_id == plane_project_id)
        ).all()
    return list(rows)


async def group_for_state(
    session: Session, plane_client, plane_project_id: str, state_id: Optional[str]
) -> Optional[str]:
    """Reverse lookup: the group (backlog/started/...) a Plane state UUID belongs to."""
    if not state_id:
        return None
    states = await _states_for(session, plane_client, plane_project_id)
    for s in states:
        if s.state_id == state_id:
            return s.group
    # Possibly a newly-added state; refresh once and retry.
    await refresh_state_cache(session, plane_client, plane_project_id)
    for s in session.exec(
        select(StateCache).where(StateCache.plane_project_id == plane_project_id)
    ).all():
        if s.state_id == state_id:
            return s.group
    return None


async def plane_label_names(
    session: Session, plane_client, plane_project_id: str, raw_labels: list
) -> list[str]:
    """Normalize Plane issue labels (which may be UUIDs or objects) to names."""
    if not raw_labels:
        return []
    names: list[str] = []
    unresolved: list[str] = []
    for item in raw_labels:
        if isinstance(item, dict):
            if item.get("name"):
                names.append(item["name"])
        else:
            unresolved.append(item)
    if unresolved:
        labels = await plane_client.list_labels(plane_project_id)
        by_id = {l["id"]: l.get("name", "") for l in labels}
        names.extend(by_id[uid] for uid in unresolved if uid in by_id)
    return names


async def resolve_state_id(
    session: Session,
    plane_client,
    plane_project_id: str,
    group: str,
    configured_name: Optional[str] = None,
) -> Optional[str]:
    """Return the concrete Plane state UUID for a target group in a project.

    Prefers an explicitly configured state name, then the group's default state,
    then the first state in that group. Returns None if the group has no states.
    """
    states = await _states_for(session, plane_client, plane_project_id)
    if configured_name:
        for s in states:
            if s.name.strip().lower() == configured_name.strip().lower():
                return s.state_id
        log.warning("configured state %r not found in project %s", configured_name, plane_project_id)
    candidates = [s for s in states if s.group == group]
    if not candidates:
        return None
    default = next((s for s in candidates if s.is_default), None)
    return (default or candidates[0]).state_id


# ---- labels ----
async def resolve_label_ids(
    session: Session, plane_client, plane_project_id: str, names: list[str]
) -> list[str]:
    """Map label names to Plane label UUIDs for a project, creating any missing."""
    if not names:
        return []
    existing = await plane_client.list_labels(plane_project_id)
    by_name = {l.get("name", "").strip().lower(): l["id"] for l in existing}
    ids: list[str] = []
    for name in names:
        key = name.strip().lower()
        if key in by_name:
            ids.append(by_name[key])
        else:
            created = await plane_client.create_label(plane_project_id, name)
            by_name[key] = created["id"]
            ids.append(created["id"])
    return ids
