"""Async client for GitLab's REST API (``/api/v4``, ``PRIVATE-TOKEN`` auth)."""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from ..config import get_settings
from ._http import request_with_retry

log = logging.getLogger("bridge.gitlab")


class GitLabClient:
    def __init__(self) -> None:
        s = get_settings()
        self._max_attempts = s.max_attempts
        self._client = httpx.AsyncClient(
            base_url=s.gitlab_api_root,
            headers={"PRIVATE-TOKEN": s.gitlab_token, "Content-Type": "application/json"},
            timeout=30.0,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _req(self, method: str, url: str, **kwargs) -> httpx.Response:
        return await request_with_retry(
            self._client, method, url, max_attempts=self._max_attempts, **kwargs
        )

    # ---- issues ----
    async def get_issue(self, project_id: int, iid: int) -> dict:
        resp = await self._req("GET", f"/projects/{project_id}/issues/{iid}")
        return resp.json()

    async def create_issue(self, project_id: int, data: dict[str, Any]) -> dict:
        resp = await self._req("POST", f"/projects/{project_id}/issues", json=data)
        return resp.json()

    async def update_issue(self, project_id: int, iid: int, data: dict[str, Any]) -> dict:
        resp = await self._req("PUT", f"/projects/{project_id}/issues/{iid}", json=data)
        return resp.json()

    async def add_issue_note(self, project_id: int, iid: int, body: str) -> dict:
        resp = await self._req(
            "POST", f"/projects/{project_id}/issues/{iid}/notes", json={"body": body}
        )
        return resp.json()

    # ---- merge requests ----
    async def get_merge_request(self, project_id: int, iid: int) -> dict:
        resp = await self._req("GET", f"/projects/{project_id}/merge_requests/{iid}")
        return resp.json()

    async def add_mr_note(self, project_id: int, iid: int, body: str) -> dict:
        resp = await self._req(
            "POST",
            f"/projects/{project_id}/merge_requests/{iid}/notes",
            json={"body": body},
        )
        return resp.json()


_client: Optional[GitLabClient] = None


def get_gitlab_client() -> GitLabClient:
    global _client
    if _client is None:
        _client = GitLabClient()
    return _client
