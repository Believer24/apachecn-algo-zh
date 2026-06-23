"""Echo-loop prevention: bot-actor detection + a neutral content hash.

The bridge guards against its own writes echoing back as webhooks with three
layers; this module implements the first two:

1. **Bot actor** -- the webhook's author equals our bot account => skip.
2. **Content hash** -- a *direction-neutral* fingerprint of the synced fields.
   When an inbound event hashes equal to what we last reconciled for that link,
   it is an echo or a no-op and is dropped.

(The third layer, duplicate-delivery dedupe, lives in the ``sync_event`` ledger.)
"""
from __future__ import annotations

import hashlib
import html as html_lib
import json
import re
from dataclasses import asdict, dataclass
from typing import Any, Iterable, Optional

import markdown as _markdown
from markdownify import markdownify as _markdownify

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


# ---- text conversion ----
def md_to_html(text: Optional[str]) -> str:
    return _markdown.markdown(text or "")


def html_to_md(html: Optional[str]) -> str:
    if not html:
        return ""
    return _markdownify(html).strip()


def normalize_ws(text: Optional[str]) -> str:
    return _WS_RE.sub(" ", (text or "")).strip()


def strip_html(html: Optional[str]) -> str:
    return normalize_ws(html_lib.unescape(_TAG_RE.sub(" ", html or "")))


def plain_from_markdown(md: Optional[str]) -> str:
    """Markdown -> normalized plaintext (via HTML, so it matches plain_from_html)."""
    return strip_html(md_to_html(md))


def plain_from_html(html: Optional[str]) -> str:
    return strip_html(html)


def normalize_labels(labels: Iterable[str]) -> tuple[str, ...]:
    return tuple(sorted({(l or "").strip().lower() for l in labels if l}))


# ---- neutral content hash ----
@dataclass(frozen=True)
class NeutralIssue:
    """Side-independent view of an issue. Built identically from either system so
    a GitLab event and the Plane echo it triggers produce the same hash."""

    title: str
    body: str
    closed: bool
    labels: tuple[str, ...]
    target_date: Optional[str]


def hash_neutral(n: NeutralIssue) -> str:
    blob = json.dumps(asdict(n), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


# ---- bot-actor detection ----
def is_gitlab_bot(payload: dict[str, Any], bot_user_id: int) -> bool:
    if not bot_user_id:
        return False
    user = payload.get("user") or {}
    return user.get("id") == bot_user_id


def is_plane_bot(payload: dict[str, Any], bot_member_id: str) -> bool:
    if not bot_member_id:
        return False
    data = payload.get("data") or {}
    actors = {data.get("created_by"), data.get("updated_by")}
    return bot_member_id in actors
