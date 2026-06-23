"""Echo-guard primitives: neutral-hash symmetry, change detection, bot actors."""
from app.sync.dedupe import (
    NeutralIssue,
    hash_neutral,
    is_gitlab_bot,
    is_plane_bot,
    normalize_labels,
    normalize_ws,
    plain_from_html,
    plain_from_markdown,
)


def _neutral(**kw) -> NeutralIssue:
    base = dict(title="Build login", body="do the thing", closed=False, labels=(), target_date=None)
    base.update(kw)
    return NeutralIssue(**base)


def test_markdown_and_html_reduce_to_same_plaintext():
    # The core premise of the echo guard: a GitLab markdown body and the Plane
    # HTML/stripped body it produces must reduce to the same neutral text.
    md = "**Hello** _world_\n\nsecond line"
    html = "<p><strong>Hello</strong> <em>world</em></p><p>second line</p>"
    assert plain_from_markdown(md) == plain_from_html(html)


def test_same_logical_issue_hashes_equal_across_sides():
    gitlab_side = _neutral(body=plain_from_markdown("**Hi** there"), labels=normalize_labels(["Bug", "ui"]))
    plane_side = _neutral(body=normalize_ws("Hi there"), labels=normalize_labels(["ui", "BUG"]))
    assert hash_neutral(gitlab_side) == hash_neutral(plane_side)


def test_hash_changes_on_each_synced_field():
    base = hash_neutral(_neutral())
    assert hash_neutral(_neutral(title="Other")) != base
    assert hash_neutral(_neutral(closed=True)) != base
    assert hash_neutral(_neutral(labels=normalize_labels(["x"]))) != base
    assert hash_neutral(_neutral(target_date="2026-01-01")) != base


def test_normalize_labels_dedupes_sorts_lowercases():
    assert normalize_labels(["B", "a", "A", "", None]) == ("a", "b")


def test_is_gitlab_bot():
    assert is_gitlab_bot({"user": {"id": 7}}, 7) is True
    assert is_gitlab_bot({"user": {"id": 9}}, 7) is False
    assert is_gitlab_bot({"user": {"id": 7}}, 0) is False  # bot id unset


def test_is_plane_bot_checks_created_and_updated_by():
    bot = "bot-uuid"
    assert is_plane_bot({"data": {"updated_by": bot}}, bot) is True
    assert is_plane_bot({"data": {"created_by": bot}}, bot) is True
    assert is_plane_bot({"data": {"updated_by": "someone"}}, bot) is False
    assert is_plane_bot({"data": {"updated_by": bot}}, "") is False
