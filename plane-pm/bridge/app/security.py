"""Webhook authenticity checks for Plane (HMAC-SHA256) and GitLab (shared token)."""
from __future__ import annotations

import hashlib
import hmac


def verify_plane_signature(payload: bytes, signature: str | None, secret: str) -> bool:
    """Validate Plane's ``X-Plane-Signature`` header (HMAC-SHA256 hex of the raw body)."""
    if not signature or not secret:
        return False
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_gitlab_token(token_header: str | None, secret: str) -> bool:
    """Validate GitLab's ``X-Gitlab-Token`` header (a plain shared secret)."""
    if not token_header or not secret:
        return False
    return hmac.compare_digest(token_header, secret)
