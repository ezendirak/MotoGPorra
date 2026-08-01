from __future__ import annotations

import requests_mock as rm_module
import pytest

from motogp_client.client import MotoGPClient
from motogp_client.exceptions import NotFoundError

BASE = "https://api.pulselive.motogp.com/motogp"

# Fixtures con la forma real confirmada mediante llamadas en vivo:
# "kind" en vez de "test", circuit anidado, "results-api-event-uuid" plano.
CALENDAR = [
    {
        "id": "event-1",
        "name": "Motorrad Grand Prix Deutschland",
        "kind": "GP",
        "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
    },
    {
        "id": "event-2",
        "name": "Gran Premio d'Italia",
        "kind": "GP",
        "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
    },
]

EVENT_1_DETAIL = {
    "id": "event-1",
    "name": "Motorrad Grand Prix Deutschland",
    "circuit": {"id": "circuit-sachsenring", "name": "Sachsenring"},
    "results-api-event-uuid": "event-uuid-1",
    "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
}

EVENT_2_DETAIL = {
    "id": "event-2",
    "name": "Gran Premio d'Italia",
    "circuit": {"id": "circuit-mugello", "name": "Mugello"},
    "results-api-event-uuid": "event-uuid-2",
    "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
}

SESSIONS_EVENT_1 = [{"id": "session-1-rac", "type": "RAC"}]
SESSIONS_EVENT_2 = [{"id": "session-2-rac", "type": "RAC"}]

# El "categoryUuid" que acepta /v1/results/sessions no es el "cat-motogp"
# del calendario: hay que resolverlo vía /v1/results/categories (ver
# SessionsEndpoint.resolve_category_uuid).
RESULTS_CATEGORIES = [{"id": "results-cat-motogp", "name": "MotoGP", "legacy_id": 3}]

# Forma real de una clasificación (recorte de la respuesta real del GP de
# Alemania 2026, MotoGP, sesión RAC), envuelta en "classification".
CLASSIFICATION_EVENT_1 = {
    "classification": [
        {
            "position": 1,
            "rider": {"full_name": "Rider A"},
            "team_name": "Team A",
            "time": "40:53.148",
            "gap": {"first": "0.000", "lap": "0"},
            "points": 25,
        },
        {
            "position": 2,
            "rider": {"full_name": "Rider B"},
            "team_name": "Team B",
            "time": "40:55.144",
            "gap": {"first": "1.996", "lap": "0"},
            "points": 20,
        },
        {
            "position": 3,
            "rider": {"full_name": "Rider C"},
            "team_name": "Team C",
            "time": "40:58.252",
            "gap": {"first": "5.104", "lap": "0"},
            "points": 16,
        },
        {
            "position": 4,
            "rider": {"full_name": "Rider D"},
            "team_name": "Team D",
            "time": "41:00.832",
            "gap": {"first": "7.684", "lap": "0"},
            "points": 13,
        },
    ]
}


@pytest.fixture()
def client() -> MotoGPClient:
    return MotoGPClient()


def test_get_calendar_current_excludes_test_and_media_events(
    client: MotoGPClient,
) -> None:
    """El calendario real (46 eventos para la 2026) mezcla Grandes Premios
    con tests de pretemporada y eventos promocionales ("MEDIA", p.ej. el
    "World Ducati Week"). get_calendar_current debe devolver solo las
    carreras reales de la temporada."""
    calendar_with_non_races = [
        {
            "id": "test-event",
            "name": "Sepang Test",
            "kind": "TEST",
            "categories": [],
        },
        *CALENDAR,
        {
            "id": "media-event",
            "name": "WORLD DUCATI WEEK",
            "kind": "MEDIA",
            "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
        },
    ]

    with rm_module.Mocker() as m:
        m.get(f"{BASE}/v1/events", json=calendar_with_non_races)

        calendar = client.get_calendar_current()

    assert [e.id for e in calendar] == ["event-1", "event-2"]


def test_get_race_results_full_flow(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(f"{BASE}/v1/events", json=CALENDAR)
        m.get(f"{BASE}/v1/events/event-1", json=EVENT_1_DETAIL)
        m.get(f"{BASE}/v1/results/categories", json=RESULTS_CATEGORIES)
        m.get(f"{BASE}/v1/results/sessions", json=SESSIONS_EVENT_1)
        m.get(
            f"{BASE}/v2/results/classifications",
            json=CLASSIFICATION_EVENT_1,
        )

        result = client.get_race_results(round=1, category="MotoGP")

    assert result.event_name == "Motorrad Grand Prix Deutschland"
    assert result.circuit == "Sachsenring"
    assert result.category == "MotoGP"
    assert result.round == 1
    assert result.session_type == "RAC"
    assert len(result.classification) == 4
    assert len(result.podium) == 3
    assert result.podium[0].rider_name == "Rider A"
    assert result.podium[0].points == 25
    assert result.podium[0].gap_to_leader == "0.000"

    # Verifica que se resolvió correctamente eventUuid y categoryUuid
    sessions_request = next(
        r for r in m.request_history if "results/sessions" in r.url
    )
    assert sessions_request.qs == {
        "eventuuid": ["event-uuid-1"],
        "categoryuuid": ["results-cat-motogp"],
    }


def test_get_latest_race_results_picks_most_recent_finished_event(
    client: MotoGPClient,
) -> None:
    with rm_module.Mocker() as m:
        m.get(f"{BASE}/v1/events", json=CALENDAR)
        m.get(f"{BASE}/v1/events/event-2", json=EVENT_2_DETAIL)
        m.get(f"{BASE}/v1/results/categories", json=RESULTS_CATEGORIES)
        m.get(f"{BASE}/v1/results/sessions", json=SESSIONS_EVENT_2)
        m.get(
            f"{BASE}/v2/results/classifications",
            json=CLASSIFICATION_EVENT_1,  # contenido irrelevante para este test
        )

        result = client.get_latest_race_results(category="MotoGP")

    assert result.event_name == "Gran Premio d'Italia"
    assert result.round == 2  # última carrera del calendario


def test_get_latest_race_results_skips_event_with_scheduled_but_empty_classification(
    client: MotoGPClient,
) -> None:
    """Reproduce el otro fallo real: la sesión RAC de un evento futuro ya
    aparece en el calendario de sesiones (con su horario previsto) antes
    de disputarse, así que /v1/results/sessions no da 404 para ella. La
    API sí devuelve 200 con clasificación vacía en ese caso, y ese evento
    debe descartarse en favor del anterior con resultados reales."""
    with rm_module.Mocker() as m:
        m.get(f"{BASE}/v1/events", json=CALENDAR)
        m.get(f"{BASE}/v1/events/event-2", json=EVENT_2_DETAIL)
        m.get(f"{BASE}/v1/events/event-1", json=EVENT_1_DETAIL)
        m.get(f"{BASE}/v1/results/categories", json=RESULTS_CATEGORIES)
        m.get(f"{BASE}/v1/results/sessions", [
            {"json": SESSIONS_EVENT_2, "status_code": 200},
            {"json": SESSIONS_EVENT_1, "status_code": 200},
        ])
        m.get(f"{BASE}/v2/results/classifications", [
            {"json": {"classification": []}, "status_code": 200},  # event-2: aún no disputado
            {"json": CLASSIFICATION_EVENT_1, "status_code": 200},  # event-1: sí disputado
        ])

        result = client.get_latest_race_results(category="MotoGP")

    assert result.event_name == "Motorrad Grand Prix Deutschland"
    assert result.round == 1
    assert len(result.podium) == 3


def test_get_latest_race_results_falls_back_to_earlier_event_without_results(
    client: MotoGPClient,
) -> None:
    """Si el evento más reciente aún no tiene clasificación (404), debe
    probar con el anterior."""
    with rm_module.Mocker() as m:
        m.get(f"{BASE}/v1/events", json=CALENDAR)
        m.get(f"{BASE}/v1/events/event-2", json=EVENT_2_DETAIL)
        m.get(f"{BASE}/v1/events/event-1", json=EVENT_1_DETAIL)
        m.get(f"{BASE}/v1/results/categories", json=RESULTS_CATEGORIES)
        m.get(f"{BASE}/v1/results/sessions", [
            {"json": [], "status_code": 200},  # sin sesiones para event-2
            {"json": SESSIONS_EVENT_1, "status_code": 200},  # sí para event-1
        ])
        m.get(f"{BASE}/v2/results/classifications", json=CLASSIFICATION_EVENT_1)

        result = client.get_latest_race_results(category="MotoGP")

    assert result.event_name == "Motorrad Grand Prix Deutschland"
    assert result.round == 1


def test_get_latest_race_results_skips_media_events_without_event_uuid(
    client: MotoGPClient,
) -> None:
    """Reproduce el fallo real: el calendario trae un evento "MEDIA" (p.ej.
    "World Ducati Week") después del último GP disputado. Ese evento no
    tiene "results-api-event-uuid" en su detalle y no debe reventar la
    búsqueda del último resultado, solo saltarse."""
    calendar_with_media_event = [
        *CALENDAR,
        {
            "id": "media-event",
            "name": "WORLD DUCATI WEEK",
            "kind": "MEDIA",
            "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
        },
    ]

    with rm_module.Mocker() as m:
        m.get(f"{BASE}/v1/events", json=calendar_with_media_event)
        m.get(f"{BASE}/v1/events/event-2", json=EVENT_2_DETAIL)
        m.get(f"{BASE}/v1/results/categories", json=RESULTS_CATEGORIES)
        m.get(f"{BASE}/v1/results/sessions", json=SESSIONS_EVENT_2)
        m.get(
            f"{BASE}/v2/results/classifications",
            json=CLASSIFICATION_EVENT_1,
        )

        result = client.get_latest_race_results(category="MotoGP")

    assert result.event_name == "Gran Premio d'Italia"


def test_get_latest_race_results_raises_when_nothing_available(
    client: MotoGPClient,
) -> None:
    with rm_module.Mocker() as m:
        m.get(f"{BASE}/v1/events", json=CALENDAR)
        m.get(f"{BASE}/v1/events/event-2", json=EVENT_2_DETAIL)
        m.get(f"{BASE}/v1/events/event-1", json=EVENT_1_DETAIL)
        m.get(f"{BASE}/v1/results/categories", json=RESULTS_CATEGORIES)
        m.get(f"{BASE}/v1/results/sessions", json=[])  # nunca hay sesión RAC

        with pytest.raises(NotFoundError):
            client.get_latest_race_results(category="MotoGP")


def test_get_completed_race_results_returns_all_finished_events_in_order(
    client: MotoGPClient,
) -> None:
    with rm_module.Mocker() as m:
        m.get(f"{BASE}/v1/events", json=CALENDAR)
        m.get(f"{BASE}/v1/events/event-1", json=EVENT_1_DETAIL)
        m.get(f"{BASE}/v1/events/event-2", json=EVENT_2_DETAIL)
        m.get(f"{BASE}/v1/results/categories", json=RESULTS_CATEGORIES)
        m.get(f"{BASE}/v1/results/sessions", [
            {"json": SESSIONS_EVENT_1, "status_code": 200},
            {"json": SESSIONS_EVENT_2, "status_code": 200},
        ])
        m.get(
            f"{BASE}/v2/results/classifications",
            json=CLASSIFICATION_EVENT_1,
        )

        results = client.get_completed_race_results(category="MotoGP")

    assert [r.event_name for r in results] == [
        "Motorrad Grand Prix Deutschland",
        "Gran Premio d'Italia",
    ]
    assert [r.round for r in results] == [1, 2]
    assert all(len(r.podium) == 3 for r in results)


def test_get_completed_race_results_skips_future_and_non_gp_events(
    client: MotoGPClient,
) -> None:
    """El calendario mezcla carreras ya disputadas con una futura (sesión
    RAC ya en el calendario pero clasificación vacía, ver el test de
    get_latest_race_results del mismo nombre) y un evento "MEDIA". Solo
    las carreras con resultados reales deben aparecer."""
    calendar_with_future_and_media = [
        *CALENDAR,
        {
            "id": "media-event",
            "name": "WORLD DUCATI WEEK",
            "kind": "MEDIA",
            "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
        },
        {
            "id": "event-3",
            "name": "Grand Prix of Valencia",
            "kind": "GP",
            "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
        },
    ]
    event_3_detail = {
        "id": "event-3",
        "name": "Grand Prix of Valencia",
        "results-api-event-uuid": "event-uuid-3",
        "categories": [{"id": "cat-motogp", "name": "MotoGP"}],
    }

    with rm_module.Mocker() as m:
        m.get(f"{BASE}/v1/events", json=calendar_with_future_and_media)
        m.get(f"{BASE}/v1/events/event-1", json=EVENT_1_DETAIL)
        m.get(f"{BASE}/v1/events/event-2", json=EVENT_2_DETAIL)
        m.get(f"{BASE}/v1/events/event-3", json=event_3_detail)
        m.get(f"{BASE}/v1/results/categories", json=RESULTS_CATEGORIES)
        m.get(f"{BASE}/v1/results/sessions", [
            {"json": SESSIONS_EVENT_1, "status_code": 200},
            {"json": SESSIONS_EVENT_2, "status_code": 200},
            {"json": [{"id": "session-3-rac", "type": "RAC"}], "status_code": 200},
        ])
        m.get(f"{BASE}/v2/results/classifications", [
            {"json": CLASSIFICATION_EVENT_1, "status_code": 200},
            {"json": CLASSIFICATION_EVENT_1, "status_code": 200},
            {"json": {"classification": []}, "status_code": 200},  # Valencia: sin disputar
        ])

        results = client.get_completed_race_results(category="MotoGP")

    assert [r.event_name for r in results] == [
        "Motorrad Grand Prix Deutschland",
        "Gran Premio d'Italia",
    ]


def test_get_completed_race_results_returns_empty_list_when_season_has_not_started(
    client: MotoGPClient,
) -> None:
    with rm_module.Mocker() as m:
        m.get(f"{BASE}/v1/events", json=CALENDAR)
        m.get(f"{BASE}/v1/events/event-1", json=EVENT_1_DETAIL)
        m.get(f"{BASE}/v1/events/event-2", json=EVENT_2_DETAIL)
        m.get(f"{BASE}/v1/results/categories", json=RESULTS_CATEGORIES)
        m.get(f"{BASE}/v1/results/sessions", json=[])  # ninguna sesión RAC todavía

        results = client.get_completed_race_results(category="MotoGP")

    assert results == []
