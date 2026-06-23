"""Configuration: environment settings + project-mapping YAML loader."""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven settings. Values come from the process env / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Plane (self-hosted)
    plane_base_url: str = "http://api:8000"
    plane_workspace_slug: str = ""
    plane_api_key: str = ""
    plane_webhook_secret: str = ""
    plane_bot_member_id: str = ""

    # GitLab (self-managed)
    gitlab_base_url: str = ""
    gitlab_token: str = ""
    gitlab_webhook_secret: str = ""
    gitlab_bot_user_id: int = 0

    # Bridge
    bridge_db_url: str = "sqlite:////data/bridge.db"
    bridge_port: int = 8000
    projects_config_path: str = "/app/config/projects.yml"
    log_level: str = "INFO"

    identifier_regex: str = r"\b([A-Z][A-Z0-9]+)-(\d+)\b"
    dedupe_ttl_seconds: int = 120

    create_missing_plane_issue: bool = True
    create_missing_gitlab_issue: bool = False

    sync_title: bool = True
    sync_description: bool = True
    sync_state: bool = True
    sync_labels: bool = True
    sync_assignees: bool = False
    sync_dates: bool = True

    delete_behavior: str = "close"  # close | ignore

    worker_poll_interval: float = 1.0
    max_attempts: int = 5

    @property
    def plane_api_root(self) -> str:
        return self.plane_base_url.rstrip("/") + "/api/v1"

    @property
    def gitlab_api_root(self) -> str:
        return self.gitlab_base_url.rstrip("/") + "/api/v4"

    @property
    def identifier_pattern(self) -> re.Pattern[str]:
        return re.compile(self.identifier_regex)


class ProjectConfig(BaseModel):
    """One GitLab<->Plane project mapping from projects.yml."""

    gitlab_project_id: int
    plane_project_id: str
    plane_project_identifier: str
    plane_workspace_slug: str | None = None  # falls back to global slug
    state_group_map: dict[str, str] = Field(default_factory=dict)
    label_sync: bool = True

    @field_validator("plane_project_identifier")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.strip().upper()


def load_projects_config(path: str | Path) -> list[ProjectConfig]:
    """Parse projects.yml into a list of ProjectConfig. Missing file -> empty list."""
    p = Path(path)
    if not p.exists():
        return []
    raw = yaml.safe_load(p.read_text()) or {}
    return [ProjectConfig(**item) for item in raw.get("projects", [])]


@lru_cache
def get_settings() -> Settings:
    return Settings()
