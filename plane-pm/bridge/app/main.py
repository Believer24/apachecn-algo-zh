"""FastAPI application: lifespan wiring (DB, config, worker) + routers."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .clients.gitlab import get_gitlab_client
from .clients.plane import get_plane_client
from .config import get_settings, load_projects_config
from .db import get_session, init_db
from .queue import start_worker, stop_worker
from .routers import admin, gitlab_webhook, health, plane_webhook
from .sync import mappings


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    log = logging.getLogger("bridge")

    init_db()
    configs = load_projects_config(settings.projects_config_path)
    with get_session() as session:
        mappings.upsert_project_mappings(session, configs, settings.plane_workspace_slug)
    log.info("loaded %d project mapping(s)", len(configs))

    start_worker()
    try:
        yield
    finally:
        await stop_worker()
        await get_plane_client().aclose()
        await get_gitlab_client().aclose()


app = FastAPI(title="GitLab-Plane Bridge", version="0.1.0", lifespan=lifespan)
app.include_router(health.router)
app.include_router(gitlab_webhook.router)
app.include_router(plane_webhook.router)
app.include_router(admin.router)


@app.get("/", tags=["health"])
async def root() -> dict:
    return {"service": "gitlab-plane-bridge", "status": "ok"}
