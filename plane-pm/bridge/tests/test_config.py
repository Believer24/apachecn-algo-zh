"""Config parsing: identifier normalization, YAML loading, API-root derivation."""
from app.config import ProjectConfig, Settings, load_projects_config


def test_identifier_is_uppercased():
    c = ProjectConfig(gitlab_project_id=1, plane_project_id="u", plane_project_identifier="proj")
    assert c.plane_project_identifier == "PROJ"


def test_load_projects_config(tmp_path):
    p = tmp_path / "projects.yml"
    p.write_text(
        "projects:\n"
        "  - gitlab_project_id: 42\n"
        '    plane_project_id: "uuid-1"\n'
        "    plane_project_identifier: proj\n"
        "    state_group_map:\n"
        "      started: In Progress\n"
    )
    cfgs = load_projects_config(p)
    assert len(cfgs) == 1
    assert cfgs[0].gitlab_project_id == 42
    assert cfgs[0].plane_project_identifier == "PROJ"
    assert cfgs[0].state_group_map["started"] == "In Progress"


def test_missing_file_returns_empty(tmp_path):
    assert load_projects_config(tmp_path / "nope.yml") == []


def test_api_roots_strip_trailing_slash():
    s = Settings(plane_base_url="http://api:8000/", gitlab_base_url="https://gl.example.com/")
    assert s.plane_api_root == "http://api:8000/api/v1"
    assert s.gitlab_api_root == "https://gl.example.com/api/v4"
