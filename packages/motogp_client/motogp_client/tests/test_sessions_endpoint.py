from __future__ import annotations

import requests_mock as rm_module
import pytest

from motogp_client.client import MotoGPClient
from motogp_client.exceptions import InvalidCategoryError, InvalidSessionError
from motogp_client.models import Session

SESSIONS = [
    {"id": "session-fp1", "type": "FP1"},
    {"id": "session-rac", "type": "RAC"},
    {"id": "session-spr", "type": "SPR"},
]

# Forma real de "GET /v1/results/categories?eventUuid=...": el "id" es un
# UUID distinto del "Category.id" que devuelve el calendario para la misma
# categoría, y el nombre incluye el símbolo de marca registrada ("MotoGPâ¢"
# en la respuesta real, aquí simplificado a "MotoGP (TM)").
RESULTS_CATEGORIES = [
    {"id": "results-cat-motogp", "name": "MotoGP (TM)", "legacy_id": 3},
    {"id": "results-cat-moto2", "name": "Moto2 (TM)", "legacy_id": 2},
    {"id": "results-cat-moto3", "name": "Moto3 (TM)", "legacy_id": 1},
]


@pytest.fixture()
def client() -> MotoGPClient:
    return MotoGPClient()


def test_list_sessions_sends_expected_params(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/results/sessions",
            json=SESSIONS,
        )
        sessions = client._sessions.list("event-uuid-x", "category-uuid-y")

    assert len(sessions) == 3
    assert m.last_request.qs == {
        "eventuuid": ["event-uuid-x"],
        "categoryuuid": ["category-uuid-y"],
    }


def test_resolve_category_uuid_matches_by_name_despite_trademark_symbol(
    client: MotoGPClient,
) -> None:
    """El "categoryUuid" del calendario (Category.id) no sirve para
    /v1/results/sessions: hay que resolverlo por nombre contra
    /v1/results/categories, cuyos nombres reales llevan un símbolo de
    marca registrada pegado (verificado con el GP de Alemania 2026)."""
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/results/categories",
            json=RESULTS_CATEGORIES,
        )
        category_uuid = client._sessions.resolve_category_uuid(
            "event-uuid-x", "MotoGP"
        )

    assert category_uuid == "results-cat-motogp"
    assert m.last_request.qs == {"eventuuid": ["event-uuid-x"]}


def test_resolve_category_uuid_raises_for_unknown_category(
    client: MotoGPClient,
) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/results/categories",
            json=RESULTS_CATEGORIES,
        )
        with pytest.raises(InvalidCategoryError):
            client._sessions.resolve_category_uuid("event-uuid-x", "Formula1")


def test_find_by_type_matches_case_insensitively() -> None:
    sessions = [Session.model_validate(s) for s in SESSIONS]
    found = client_find_by_type(sessions, "rac")
    assert found.id == "session-rac"


def test_find_by_type_raises_when_not_found() -> None:
    sessions = [Session.model_validate(s) for s in SESSIONS]
    with pytest.raises(InvalidSessionError):
        client_find_by_type(sessions, "WUP")


def client_find_by_type(sessions: list[Session], session_type: str) -> Session:
    from motogp_client.endpoints.sessions import SessionsEndpoint

    return SessionsEndpoint.find_by_type(sessions, session_type)
