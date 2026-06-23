"""Inbound Plane webhook: verify HMAC signature, drop our own echoes, enqueue."""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Header, Request, Response

from ..config import get_settings
from ..queue import body_hash, enqueue
from ..security import verify_plane_signature
from ..sync.dedupe import is_plane_bot

router = APIRouter(tags=["webhooks"])
log = logging.getLogger("bridge.webhook.plane")


@router.post("/webhooks/plane", response_model=None)
async def plane_webhook(
    request: Request,
    x_plane_signature: str | None = Header(default=None),
) -> Response | dict:
    settings = get_settings()
    body = await request.body()
    if not verify_plane_signature(body, x_plane_signature, settings.plane_webhook_secret):
        return Response(status_code=401)

    payload = json.loads(body)
    if payload.get("event") != "issue":
        return {"status": "ignored"}  # only work items are synced for now

    if is_plane_bot(payload, settings.plane_bot_member_id):
        return {"status": "skipped_echo"}

    action = payload.get("action")
    data = payload.get("data") or {}
    wi_id = data.get("id")

    enqueue(
        source="plane",
        event_type="issue",
        action=action,
        external_ref=f"pl:{data.get('project')}:{wi_id}",
        delivery_id=None,
        dedupe_key=f"plane:issue:{wi_id}:{action}:{body_hash(body)}",
        payload=body.decode("utf-8"),
        payload_hash=body_hash(body),
    )
    return {"status": "queued"}
