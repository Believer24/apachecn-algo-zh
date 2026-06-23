"""Database engine/session setup and one-time initialization."""
from __future__ import annotations

import os

from sqlmodel import Session, SQLModel, create_engine

from .config import get_settings

_settings = get_settings()
_connect_args = (
    {"check_same_thread": False} if _settings.bridge_db_url.startswith("sqlite") else {}
)
engine = create_engine(_settings.bridge_db_url, connect_args=_connect_args, echo=False)


def _ensure_sqlite_dir(db_url: str) -> None:
    """Make sure the parent directory of a sqlite file exists."""
    if not db_url.startswith("sqlite"):
        return
    path = db_url.split("sqlite:///", 1)[-1]
    if path in ("", ":memory:") or path.startswith(":"):
        return
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def init_db() -> None:
    # Import models so their tables are registered on SQLModel.metadata.
    from . import models  # noqa: F401

    _ensure_sqlite_dir(_settings.bridge_db_url)
    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    return Session(engine)
