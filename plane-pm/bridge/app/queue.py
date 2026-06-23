"""Durable in-process job queue.

Webhook handlers persist a ``SyncEvent`` (the durable ledger) and call
``notify()``; a single background worker drains pending rows, processing each
through the sync engine. Because every job is a DB row, a restart resumes any
work that was pending or mid-flight. The ``sync_event.dedupe_key`` unique index
also drops duplicate webhook deliveries.

The single-worker model keeps ordering simple and avoids cross-event races; the
clean swap-out path is an external broker (arq on Plane's valkey) later.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import Optional

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from .config import get_settings
from .db import get_session
from .models import SyncEvent, utcnow
from .sync.engine import process_event

log = logging.getLogger("bridge.queue")

_wakeup = asyncio.Event()
_stop = asyncio.Event()
_task: Optional[asyncio.Task] = None

_TERMINAL = {"done", "skipped_echo", "ignored"}


def body_hash(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()[:32]


def notify() -> None:
    """Wake the worker (called right after an event is enqueued)."""
    _wakeup.set()


def enqueue(
    *,
    source: str,
    event_type: str,
    action: Optional[str],
    external_ref: Optional[str],
    delivery_id: Optional[str],
    dedupe_key: str,
    payload: str,
    payload_hash: Optional[str] = None,
) -> bool:
    """Persist one event. Returns False if it was a duplicate delivery."""
    with get_session() as session:
        existing = session.exec(
            select(SyncEvent).where(SyncEvent.dedupe_key == dedupe_key)
        ).first()
        if existing:
            return False
        session.add(
            SyncEvent(
                source=source,
                event_type=event_type,
                action=action,
                external_ref=external_ref,
                delivery_id=delivery_id,
                dedupe_key=dedupe_key,
                payload=payload,
                payload_hash=payload_hash,
            )
        )
        try:
            session.commit()
        except IntegrityError:  # raced with another delivery on the unique key
            session.rollback()
            return False
    notify()
    return True


def _backoff_seconds(attempts: int) -> float:
    return min(2 ** attempts, 60)


def _claim_next(session: Session) -> Optional[SyncEvent]:
    """Pick the oldest pending event that is eligible (respecting retry backoff)."""
    rows = session.exec(
        select(SyncEvent)
        .where(SyncEvent.status == "pending")
        .order_by(SyncEvent.id)
        .limit(100)
    ).all()
    now = utcnow()
    for evt in rows:
        if evt.attempts and evt.processed_at:
            if (now - evt.processed_at).total_seconds() < _backoff_seconds(evt.attempts):
                continue
        evt.status = "processing"
        session.add(evt)
        session.commit()
        session.refresh(evt)
        return evt
    return None


async def _process_one() -> bool:
    settings = get_settings()
    with get_session() as session:
        evt = _claim_next(session)
        if evt is None:
            return False
        try:
            status = await process_event(session, evt)
            evt.status = status if status in _TERMINAL else "done"
            evt.error = None
        except Exception as exc:
            evt.attempts += 1
            evt.error = repr(exc)
            evt.status = "failed" if evt.attempts >= settings.max_attempts else "pending"
            log.exception("event %s failed (attempt %d)", evt.id, evt.attempts)
        evt.processed_at = utcnow()
        session.add(evt)
        session.commit()
        return True


async def worker_loop() -> None:
    settings = get_settings()
    log.info("sync worker started")
    while not _stop.is_set():
        try:
            drained = True
            while drained and not _stop.is_set():
                drained = await _process_one()
        except Exception:
            log.exception("worker iteration error")
        _wakeup.clear()
        try:
            await asyncio.wait_for(_wakeup.wait(), timeout=settings.worker_poll_interval)
        except asyncio.TimeoutError:
            pass
    log.info("sync worker stopped")


def start_worker() -> None:
    global _task
    _stop.clear()
    _task = asyncio.create_task(worker_loop())


async def stop_worker() -> None:
    _stop.set()
    notify()
    if _task is not None:
        try:
            await asyncio.wait_for(_task, timeout=10)
        except asyncio.TimeoutError:
            _task.cancel()


def status_summary() -> dict[str, int]:
    with get_session() as session:
        rows = session.exec(
            select(SyncEvent.status, func.count()).group_by(SyncEvent.status)
        ).all()
    return {status: count for status, count in rows}
