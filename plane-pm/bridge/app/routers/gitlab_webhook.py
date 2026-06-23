"""Inbound GitLab webhook: validate, drop our own echoes, enqueue."""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Header, Request, Response

from ..config import get_settings
from ..queue import body_hash, enqueue
from ..security import verify_gitlab_token
from ..sync.dedupe import is_gitlab_bot

router = APIRouter(tags=["webhooks"])
log = logging.getLogger("bridge.webhook.gitlab")

_KIND_TO_TYPE = {
    "issue": "issue",
    "merge_request": "merge_request",
    "push": "push",
}


@router.post("/webhooks/gitlab", response_model=None)
async def gitlab_webhook(
    request: Request,
    x_gitlab_token: str | None = Header(default=None),
    x_gitlab_event_uuid: str | None = Header(default=None),
) -> Response | dict:
    settings = get_settings()
    body = await request.body()
    if not verify_gitlab_token(x_gitlab_token, settings.gitlab_webhook_secret):
        return Response(status_code=401)

    payload = json.loads(body)
    kind = payload.get("object_kind")
    event_type = _KIND_TO_TYPE.get(kind)
    if event_type is None:
        return {"status": "ignored"}  # note/pipeline/etc. not handled

    if is_gitlab_bot(payload, settings.gitlab_bot_user_id):
        return {"status": "skipped_echo"}

    obj = payload.get("object_attributes") or {}
    project_id = (payload.get("project") or {}).get("id") or payload.get("project_id")
    iid = obj.get("iid")
    action = obj.get("action")

    delivery = x_gitlab_event_uuid
    if delivery:
        dedupe = f"gitlab:{delivery}"
    else:
        dedupe = f"gitlab:{kind}:{project_id}:{iid}:{action}:{body_hash(body)}"

    enqueue(
        source="gitlab",
        event_type=event_type,
        action=action,
        external_ref=f"gl:{project_id}:{kind}:{iid}",
        delivery_id=delivery,
        dedupe_key=dedupe,
        payload=body.decode("utf-8"),
        payload_hash=body_hash(body),
    )
    return {"status": "queued"}
