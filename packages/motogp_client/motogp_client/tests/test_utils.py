from __future__ import annotations

from motogp_client.utils import find_best_match, looks_like_uuid, normalize


def test_looks_like_uuid_true_for_valid_uuid() -> None:
    assert looks_like_uuid("259be6f4-c23c-4dc2-bc42-7664842f6409") is True


def test_looks_like_uuid_false_for_plain_name() -> None:
    assert looks_like_uuid("Germany") is False


def test_normalize_strips_and_casefolds() -> None:
    assert normalize("  Marc   Marquez  ") == "marc marquez"


def test_find_best_match_exact() -> None:
    items = ["Germany", "Great Britain", "Italy"]
    result = find_best_match(items, "italy", text_fn=lambda x: x)
    assert result == "Italy"


def test_find_best_match_substring() -> None:
    items = ["Motorrad Grand Prix Deutschland", "Gran Premio d'Italia"]
    result = find_best_match(items, "Deutschland", text_fn=lambda x: x)
    assert result == "Motorrad Grand Prix Deutschland"


def test_find_best_match_fuzzy_typo() -> None:
    items = ["Germany", "Great Britain", "Italy"]
    result = find_best_match(items, "Germani", text_fn=lambda x: x)
    assert result == "Germany"


def test_find_best_match_returns_none_when_nothing_close() -> None:
    items = ["Germany", "Great Britain", "Italy"]
    result = find_best_match(items, "xyzxyzxyz", text_fn=lambda x: x)
    assert result is None
