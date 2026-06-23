"""Dispatch a queued ``SyncEvent`` to the appropriate sync handler."""
from __future__ import annotations

import json
import logging

from sqlmodel import Session

from ..models import SyncEvent
from .issues import handle_gitlab_issue, handle_plane_issue
from .merge_requests import handle_gitlab_merge_request, handle_gitlab_push

log = logging.getLogger("bridge.engine")

_HANDLERS = {
    ("gitlab", "issue"): handle_gitlab_issue,
    ("gitlab", "merge_request"): handle_gitlab_merge_request,
    ("gitlab", "push"): handle_gitlab_push,
    ("plane", "issue"): handle_plane_issue,
}


async def process_event(session: Session, evt: SyncEvent) -> str:
    """Run the handler for one event and return its terminal status string."""
    handler = _HANDLERS.get((evt.source, evt.event_type))
    if handler is None:
        log.debug("no handler for %s/%s", evt.source, evt.event_type)
        return "ignored"
    payload = json.loads(evt.payload)
    return await handler(session, payload)
