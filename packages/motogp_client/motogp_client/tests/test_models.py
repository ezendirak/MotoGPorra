from __future__ import annotations

from motogp_client.models import ClassificationEntry, Event, Rider


def test_event_from_calendar_listing_has_no_event_uuid() -> None:
    # Forma real (recortada) de un item del calendario, GET /v1/events.
    data = {
        "id": "259be6f4-c23c-4dc2-bc42-7664842f6409",
        "name": "LIQUI MOLY GRAND PRIX OF GERMANY",
        "shortname": "GER",
        "country": "DE",
        "circuit": {"id": "29557159-9464-4c2c-81c7-40c2af39171d", "name": "Sachsenring"},
        "status": "FINISHED",
        "kind": "GP",
        "sequence": 11,
        "categories": [
            {"id": "93888447-8746-4161-882c-e08a1d48447e", "name": "MotoGP"},
        ],
    }

    event = Event.model_validate(data)

    assert event.id == "259be6f4-c23c-4dc2-bc42-7664842f6409"
    assert event.short_name == "GER"
    assert event.circuit_name == "Sachsenring"
    assert event.is_test is False
    assert event.event_uuid is None
    assert event.get_category("MotoGP") is not None
    assert event.get_category("motogp") is not None  # case-insensitive
    assert event.get_category("Moto2") is None


def test_event_detects_test_events_via_kind() -> None:
    data = {"id": "sepang-test", "name": "Sepang Test", "kind": "TEST"}

    event = Event.model_validate(data)

    assert event.is_test is True


def test_event_from_detail_exposes_event_uuid() -> None:
    # Forma real confirmada: campo plano "results-api-event-uuid",
    # no anidado bajo "results_api.eventUuid".
    data = {
        "id": "259be6f4-c23c-4dc2-bc42-7664842f6409",
        "name": "LIQUI MOLY GRAND PRIX OF GERMANY",
        "results-api-event-uuid": "b26a84f7-2d9b-4cc5-a3e5-3d1abe916d8c",
        "broadcasts": [{"some": "data"}],
    }

    event = Event.model_validate(data)

    assert event.event_uuid == "b26a84f7-2d9b-4cc5-a3e5-3d1abe916d8c"
    # Campos no modelados explícitamente se conservan en `raw`.
    assert "broadcasts" in event.raw


def test_event_tolerates_unknown_fields() -> None:
    data = {
        "id": "abc",
        "name": "Test GP",
        "some_new_field_the_api_added_tomorrow": 42,
    }

    event = Event.model_validate(data)

    assert event.id == "abc"
    assert event.raw["some_new_field_the_api_added_tomorrow"] == 42


def test_rider_full_name_and_nested_category_from_real_shape() -> None:
    # Recorte de una respuesta real de GET /v1/riders (temporada 2026).
    data = {
        "id": "23e50438-a657-4fb0-a190-3262b5472f29",
        "name": "Marc",
        "surname": "Marquez",
        "legacy_id": 7444,
        "country": {"iso": "ES", "name": "Spain"},
        "current_career_step": {
            "season": 2026,
            "number": 93,
            "sponsored_team": "Ducati Lenovo Team",
            "team": {
                "id": "892fff2f-7402-4fbd-99fb-5fd567d8a80c",
                "name": "Ducati Lenovo Team",
                "constructor": {"id": "ducati", "name": "Ducati"},
            },
            "category": {
                "id": "737ab122-76e1-4081-bedb-334caaa18c70",
                "name": "MotoGP",
                "legacy_id": 3,
            },
            "current": True,
        },
    }

    rider = Rider.model_validate(data)

    assert rider.full_name == "Marc Marquez"
    assert rider.category_name == "MotoGP"
    assert rider.team_name == "Ducati Lenovo Team"
    assert rider.number == 93


def test_classification_entry_from_real_response_shape() -> None:
    # Entrada real (GP de Alemania 2026, MotoGP, sesión RAC).
    data = {
        "id": "7934fe82-a960-4a77-8191-0becb1b191f7",
        "position": 1,
        "rider": {
            "id": "f55b433d-38b8-4d1d-bb3a-a709c82a0260",
            "full_name": "Marc Marquez",
            "country": {"iso": "ES", "name": "Spain"},
            "number": 93,
        },
        "constructor": {"id": "b9d93efb-3cd0-4681-9de4-c412a866d568", "name": "Ducati"},
        "team_name": "Ducati Lenovo Team",
        "average_speed": 161.6,
        "gap": {"first": "0.000", "lap": "0"},
        "total_laps": 30,
        "time": "40:53.148",
        "points": 25,
        "status": "INSTND",
    }

    entry = ClassificationEntry.model_validate(data)

    assert entry.position == 1
    assert entry.rider_name == "Marc Marquez"
    assert entry.team_name == "Ducati Lenovo Team"
    assert entry.time == "40:53.148"
    assert entry.gap_to_leader == "0.000"
    assert entry.points == 25


def test_classification_entry_handles_retired_rider() -> None:
    # Piloto retirado: position es null y status es "OUTSTND".
    data = {
        "position": None,
        "rider": {"full_name": "Some Rider"},
        "team_name": "Some Team",
        "status": "OUTSTND",
        "gap": {"first": "0.000", "lap": "4"},
    }

    entry = ClassificationEntry.model_validate(data)

    assert entry.position is None
    assert entry.status == "OUTSTND"
