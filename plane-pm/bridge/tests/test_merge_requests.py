"""MR/commit state machine: lifecycle mapping, reference extraction, close keywords."""
from app.sync import merge_requests as mr


def test_mr_group_lifecycle():
    assert mr._mr_group("merged", "merge", False) == "completed"
    assert mr._mr_group("opened", "open", False) == "started"
    assert mr._mr_group("opened", "update", True) == "unstarted"   # draft/WIP
    assert mr._mr_group("closed", "close", False) is None          # leave unchanged by default
    assert mr._mr_group("locked", None, False) is None


def test_references_extracts_identifiers():
    refs = mr._references("feature/PROJ-12-login refs OPS-3 and PROJ-12 again")
    assert refs == {("PROJ", 12), ("OPS", 3)}


def test_references_empty_when_none():
    assert mr._references("just a plain branch name") == set()


def test_close_keywords_match():
    for msg in ["Closes PROJ-1", "this fixes things", "resolved the bug", "FIX flow"]:
        assert mr._CLOSE_KEYWORDS.search(msg) is not None
    assert mr._CLOSE_KEYWORDS.search("closure of accounts") is None
    assert mr._CLOSE_KEYWORDS.search("reference only") is None
