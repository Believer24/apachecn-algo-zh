"""Operational endpoints: inspect the sync ledger and requeue failures."""
from __future__ import annotations

from fastapi import APIRouter, Response
from sqlmodel import select

from ..db import get_session
from ..models import SyncEvent
from ..queue import notify, status_summary

router = APIRouter(prefix="/sync", tags=["admin"])


@router.get("/status")
async def sync_status() -> dict:
    return {"events": status_summary()}


@router.get("/events")
async def sync_events(status: str | None = None, limit: int = 50) -> list[dict]:
    with get_session() as session:
        stmt = select(SyncEvent).order_by(SyncEvent.id.desc()).limit(limit)
        if status:
            stmt = (
                select(SyncEvent)
                .where(SyncEvent.status == status)
                .order_by(SyncEvent.id.desc())
                .limit(limit)
            )
        rows = session.exec(stmt).all()
    return [
        {
            "id": e.id,
            "source": e.source,
            "type": e.event_type,
            "action": e.action,
            "status": e.status,
            "attempts": e.attempts,
            "error": e.error,
            "received_at": e.received_at.isoformat() if e.received_at else None,
        }
        for e in rows
    ]


@router.post("/retry/{event_id}", response_model=None)
async def retry_event(event_id: int) -> Response | dict:
    with get_session() as session:
        evt = session.get(SyncEvent, event_id)
        if evt is None:
            return Response(status_code=404)
        evt.status = "pending"
        evt.attempts = 0
        evt.error = None
        session.add(evt)
        session.commit()
    notify()
    return {"status": "requeued"}
