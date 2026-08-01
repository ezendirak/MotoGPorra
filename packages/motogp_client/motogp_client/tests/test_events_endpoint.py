from __future__ import annotations

import requests_mock as rm_module
import pytest

from motogp_client.client import MotoGPClient
from motogp_client.exceptions import InvalidCategoryError, NotFoundError

# Fixtures con la forma real confirmada mediante llamadas en vivo:
# "kind" (no "test") distingue eventos de test, "results-api-event-uuid"
# es un campo plano (no anidado), "sequence" es el número de ronda real.
CALENDAR_2026 = [
    {
        "id": "test-event-uuid-0",
        "name": "Sepang Test",
        "shortname": "TEST",
        "kind": "TEST",
        "sequence": 0,
        "categories": [],
    },
    {
        "id": "event-id-1",
        "name": "Motorrad Grand Prix Deutschland",
        "shortname": "GER",
        "kind": "GP",
        "sequence": 1,
        "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
    },
    {
        "id": "media-event-uuid-0",
        "name": "WORLD DUCATI WEEK",
        "shortname": "WDW",
        "kind": "MEDIA",
        "sequence": 12,
        "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
    },
    {
        "id": "event-id-2",
        "name": "Gran Premio d'Italia",
        "shortname": "ITA",
        "kind": "GP",
        "sequence": 2,
        "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
    },
]

EVENT_2_DETAIL = {
    "id": "event-id-2",
    "name": "Gran Premio d'Italia",
    "results-api-event-uuid": "event-uuid-2",
    "circuit": {"id": "circuit-mugello", "name": "Mugello"},
    "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
}


@pytest.fixture()
def client() -> MotoGPClient:
    return MotoGPClient()


def test_list_races_excludes_test_and_media_events(client: MotoGPClient) -> None:
    """El calendario real incluye tests de pretemporada ("kind": "TEST")
    y eventos promocionales sin resultados ("kind": "MEDIA", p.ej. el
    "World Ducati Week"). Ninguno debe contar como carrera."""
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events",
            json=CALENDAR_2026,
        )
        races = client._events.list_races(2026)

    assert [r.id for r in races] == ["event-id-1", "event-id-2"]


def test_get_by_round_uses_explicit_sequence_field(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events",
            json=CALENDAR_2026,
        )
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events/event-id-2",
            json=EVENT_2_DETAIL,
        )

        # round=2 -> el evento con sequence=2 (el test de Sepang no cuenta)
        event = client._events.get_by_round(2026, 2)

    assert event.id == "event-id-2"
    assert event.event_uuid == "event-uuid-2"
    assert event.circuit_name == "Mugello"


def test_get_by_round_falls_back_to_calendar_position_without_sequence(
    client: MotoGPClient,
) -> None:
    calendar_without_sequence = [
        {
            "id": "event-id-1",
            "name": "Motorrad Grand Prix Deutschland",
            "kind": "GP",
            "categories": [],
        },
    ]
    detail = {"id": "event-id-1", "name": "Motorrad Grand Prix Deutschland"}

    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events",
            json=calendar_without_sequence,
        )
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events/event-id-1",
            json=detail,
        )

        # Sin "sequence" disponible, round=1 debe caer en la 1ª posición.
        event = client._events.get_by_round(2026, 1)

    assert event.id == "event-id-1"


def test_get_by_round_raises_not_found_out_of_range(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events",
            json=CALENDAR_2026,
        )

        with pytest.raises(NotFoundError):
            client._events.get_by_round(2026, 99)


def test_event_is_test_detects_kind_test() -> None:
    from motogp_client.models import Event

    test_event = Event.model_validate({"id": "x", "name": "Test", "kind": "TEST"})
    race_event = Event.model_validate({"id": "y", "name": "GP", "kind": "GP"})

    assert test_event.is_test is True
    assert race_event.is_test is False


def test_event_is_race_only_true_for_kind_gp() -> None:
    from motogp_client.models import Event

    test_event = Event.model_validate({"id": "x", "name": "Test", "kind": "TEST"})
    media_event = Event.model_validate(
        {"id": "z", "name": "World Ducati Week", "kind": "MEDIA"}
    )
    race_event = Event.model_validate({"id": "y", "name": "GP", "kind": "GP"})

    assert test_event.is_race is False
    assert media_event.is_race is False
    assert race_event.is_race is True


def test_resolve_category_is_case_insensitive(client: MotoGPClient) -> None:
    from motogp_client.models import Event

    event = Event.model_validate(EVENT_2_DETAIL)
    category = client._events.resolve_category(event, "motogp")

    assert category.name == "MotoGP"


def test_resolve_category_raises_for_unknown_category(client: MotoGPClient) -> None:
    from motogp_client.models import Event

    event = Event.model_validate(EVENT_2_DETAIL)

    with pytest.raises(InvalidCategoryError):
        client._events.resolve_category(event, "Formula1")
