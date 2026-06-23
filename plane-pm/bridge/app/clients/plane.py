"""Async client for Plane's self-hosted REST API (``/api/v1``, ``X-API-Key`` auth)."""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from ..config import get_settings
from ._http import request_with_retry

log = logging.getLogger("bridge.plane")


class PlaneClient:
    def __init__(self) -> None:
        s = get_settings()
        self._slug = s.plane_workspace_slug
        self._max_attempts = s.max_attempts
        self._client = httpx.AsyncClient(
            base_url=s.plane_api_root,
            headers={"X-API-Key": s.plane_api_key, "Content-Type": "application/json"},
            timeout=30.0,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    def _ws(self, slug: Optional[str]) -> str:
        return slug or self._slug

    async def _req(self, method: str, url: str, **kwargs) -> httpx.Response:
        return await request_with_retry(
            self._client, method, url, max_attempts=self._max_attempts, **kwargs
        )

    async def _paginate(self, url: str, params: Optional[dict] = None) -> list[dict]:
        params = dict(params or {})
        out: list[dict] = []
        cursor: Optional[str] = None
        for _ in range(200):  # hard page cap as a runaway guard
            if cursor:
                params["cursor"] = cursor
            data = (await self._req("GET", url, params=params)).json()
            if isinstance(data, list):  # some endpoints return a bare list
                out.extend(data)
                break
            out.extend(data.get("results", []))
            if not data.get("next_page_results"):
                break
            cursor = data.get("next_cursor")
            if not cursor:
                break
        return out

    # ---- projects / states / members / labels ----
    async def list_projects(self, slug: Optional[str] = None) -> list[dict]:
        return await self._paginate(f"/workspaces/{self._ws(slug)}/projects/")

    async def list_states(self, project_id: str, slug: Optional[str] = None) -> list[dict]:
        return await self._paginate(
            f"/workspaces/{self._ws(slug)}/projects/{project_id}/states/"
        )

    async def list_members(self, slug: Optional[str] = None) -> list[dict]:
        return await self._paginate(f"/workspaces/{self._ws(slug)}/members/")

    async def list_labels(self, project_id: str, slug: Optional[str] = None) -> list[dict]:
        return await self._paginate(
            f"/workspaces/{self._ws(slug)}/projects/{project_id}/labels/"
        )

    async def create_label(
        self, project_id: str, name: str, slug: Optional[str] = None
    ) -> dict:
        resp = await self._req(
            "POST",
            f"/workspaces/{self._ws(slug)}/projects/{project_id}/labels/",
            json={"name": name},
        )
        return resp.json()

    # ---- work items (issues) ----
    async def get_issue(
        self, project_id: str, issue_id: str, slug: Optional[str] = None
    ) -> dict:
        resp = await self._req(
            "GET", f"/workspaces/{self._ws(slug)}/projects/{project_id}/issues/{issue_id}/"
        )
        return resp.json()

    async def create_issue(
        self, project_id: str, data: dict[str, Any], slug: Optional[str] = None
    ) -> dict:
        resp = await self._req(
            "POST",
            f"/workspaces/{self._ws(slug)}/projects/{project_id}/issues/",
            json=data,
        )
        return resp.json()

    async def update_issue(
        self, project_id: str, issue_id: str, data: dict[str, Any], slug: Optional[str] = None
    ) -> dict:
        resp = await self._req(
            "PATCH",
            f"/workspaces/{self._ws(slug)}/projects/{project_id}/issues/{issue_id}/",
            json=data,
        )
        return resp.json()

    async def add_comment(
        self, project_id: str, issue_id: str, html: str, slug: Optional[str] = None
    ) -> dict:
        resp = await self._req(
            "POST",
            f"/workspaces/{self._ws(slug)}/projects/{project_id}/issues/{issue_id}/comments/",
            json={"comment_html": html},
        )
        return resp.json()

    async def find_issue_by_sequence(
        self, project_id: str, sequence_id: int, slug: Optional[str] = None
    ) -> Optional[dict]:
        """Locate a work item by its human sequence id (e.g. the 123 in PROJ-123).

        Plane's list endpoint has no sequence filter, so we page with a trimmed
        field set and match client-side. Capped by ``_paginate``'s page guard.
        """
        items = await self._paginate(
            f"/workspaces/{self._ws(slug)}/projects/{project_id}/issues/",
            params={"fields": "id,sequence_id,name"},
        )
        for it in items:
            if it.get("sequence_id") == sequence_id:
                return it
        return None


_client: Optional[PlaneClient] = None


def get_plane_client() -> PlaneClient:
    global _client
    if _client is None:
        _client = PlaneClient()
    return _client
