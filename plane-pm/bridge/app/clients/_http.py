"""Shared async HTTP helper with retry/backoff that honours Retry-After."""
from __future__ import annotations

import asyncio
import logging

import httpx

log = logging.getLogger("bridge.http")

_RETRY_STATUS = {429, 500, 502, 503, 504}


async def request_with_retry(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    max_attempts: int = 5,
    **kwargs,
) -> httpx.Response:
    """Issue a request, retrying transient failures with exponential backoff.

    Honours a ``Retry-After`` header on 429 responses. Raises for status on the
    final attempt (or immediately for non-retryable 4xx).
    """
    attempt = 0
    while True:
        attempt += 1
        try:
            resp = await client.request(method, url, **kwargs)
        except httpx.TransportError as exc:
            if attempt >= max_attempts:
                raise
            delay = min(2 ** attempt, 30)
            log.warning("transport error on %s %s (attempt %d): %s", method, url, attempt, exc)
            await asyncio.sleep(delay)
            continue

        if resp.status_code in _RETRY_STATUS and attempt < max_attempts:
            retry_after = resp.headers.get("Retry-After")
            try:
                delay = float(retry_after) if retry_after else min(2 ** attempt, 30)
            except ValueError:
                delay = min(2 ** attempt, 30)
            log.warning(
                "retryable status %s on %s %s (attempt %d), sleeping %.1fs",
                resp.status_code, method, url, attempt, delay,
            )
            await asyncio.sleep(delay)
            continue

        resp.raise_for_status()
        return resp
