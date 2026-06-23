"""SQLModel tables: project mappings, issue/MR links, caches, and the sync ledger."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.utcnow()


class ProjectMapping(SQLModel, table=True):
    __tablename__ = "project_mapping"

    id: Optional[int] = Field(default=None, primary_key=True)
    gitlab_project_id: int = Field(index=True, unique=True)
    plane_workspace_slug: str
    plane_project_id: str = Field(index=True)
    plane_project_identifier: str = Field(index=True)
    active: bool = True
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class IssueLink(SQLModel, table=True):
    """A linked pair: one GitLab issue <-> one Plane work item."""

    __tablename__ = "issue_link"
    __table_args__ = (
        UniqueConstraint("project_mapping_id", "gitlab_issue_iid", name="uq_issuelink_gitlab"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    project_mapping_id: int = Field(foreign_key="project_mapping.id", index=True)
    gitlab_issue_iid: int = Field(index=True)
    plane_work_item_id: str = Field(index=True, unique=True)
    plane_sequence_id: Optional[int] = Field(default=None, index=True)
    origin: str = "gitlab"  # gitlab | plane

    # Neutral content hash of the last state the bridge reconciled (echo guard).
    last_synced_hash: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    gitlab_updated_at: Optional[datetime] = None
    plane_updated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)


class MRLink(SQLModel, table=True):
    """A GitLab merge request linked to a Plane work item (drives state transitions)."""

    __tablename__ = "mr_link"
    __table_args__ = (
        UniqueConstraint(
            "project_mapping_id", "gitlab_mr_iid", "plane_work_item_id", name="uq_mrlink"
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    project_mapping_id: int = Field(foreign_key="project_mapping.id", index=True)
    gitlab_mr_iid: int = Field(index=True)
    plane_work_item_id: str = Field(index=True)
    last_mr_state: Optional[str] = None
    last_applied_state_group: Optional[str] = None
    commented: bool = False
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class StateCache(SQLModel, table=True):
    """Cached Plane states per project, used to resolve a state group -> concrete UUID."""

    __tablename__ = "state_cache"
    __table_args__ = (UniqueConstraint("plane_project_id", "state_id", name="uq_state"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    plane_project_id: str = Field(index=True)
    state_id: str
    name: str
    group: str  # backlog|unstarted|started|completed|cancelled
    is_default: bool = False
    refreshed_at: datetime = Field(default_factory=utcnow)


class UserMapping(SQLModel, table=True):
    """Best-effort GitLab user <-> Plane member mapping for assignee sync."""

    __tablename__ = "user_mapping"

    id: Optional[int] = Field(default=None, primary_key=True)
    gitlab_user_id: int = Field(index=True, unique=True)
    gitlab_username: Optional[str] = None
    plane_member_id: Optional[str] = None
    email: Optional[str] = Field(default=None, index=True)


class SyncEvent(SQLModel, table=True):
    """Durable job queue + dedupe/echo ledger. One row per inbound webhook delivery."""

    __tablename__ = "sync_event"

    id: Optional[int] = Field(default=None, primary_key=True)
    source: str  # gitlab | plane
    event_type: str  # issue | merge_request | push | note
    action: Optional[str] = None
    external_ref: Optional[str] = Field(default=None, index=True)
    delivery_id: Optional[str] = Field(default=None, index=True)
    dedupe_key: str = Field(index=True, unique=True)
    payload: str
    payload_hash: Optional[str] = None
    status: str = Field(default="pending", index=True)  # pending|processing|done|failed|skipped_echo
    attempts: int = 0
    error: Optional[str] = None
    received_at: datetime = Field(default_factory=utcnow, index=True)
    processed_at: Optional[datetime] = None
