"""Tests de ClassificationsEndpoint.

Los fixtures usan la forma de respuesta REAL, confirmada con una
llamada en vivo al endpoint exacto proporcionado por el usuario
(GET /v2/results/classifications?session=...&test=false, GP de
Alemania 2026, categoría MotoGP, sesión RAC): clasificación anidada
bajo "classification", "team_name" como texto plano, "time" como
tiempo total de carrera, "gap" con "first"/"lap", y "points" presente
por sesión.
"""

from __future__ import annotations

import requests_mock as rm_module
import pytest

from motogp_client.client import MotoGPClient

# Recorte real (3 de los ~20 pilotos) de la respuesta real obtenida.
CLASSIFICATION_ENTRIES = [
    {
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
    },
    {
        "id": "597a753d-7c85-4008-b2ce-9aa00087c194",
        "position": 2,
        "rider": {"id": "eb47c439-e136-40ff-9534-5c612853f529", "full_name": "Ai Ogura", "number": 79},
        "constructor": {"id": "aprilia", "name": "Aprilia"},
        "team_name": "SuperFile Trackhouse MotoGP Team",
        "gap": {"first": "1.996", "lap": "0"},
        "total_laps": 30,
        "time": "40:55.144",
        "points": 20,
        "status": "INSTND",
    },
    {
        # Piloto retirado: position es null, status "OUTSTND".
        "id": "e04ece38-7645-44e0-a40c-d74bb0266100",
        "position": None,
        "rider": {"id": "66ee98b2-239c-487f-8913-aab8493ce280", "full_name": "Maverick Viñales", "number": 12},
        "constructor": {"id": "ktm", "name": "KTM"},
        "team_name": "Red Bull KTM Tech3",
        "gap": {"first": "0.000", "lap": "4"},
        "total_laps": 26,
        "time": "36:11.126",
        "points": 0,
        "status": "OUTSTND",
    },
]

CLASSIFICATION_RESPONSE = {
    "classification": CLASSIFICATION_ENTRIES,
    "official": True,
    "files": {"classification": "https://resources.motogp.com/files/results/2026/GER/MotoGP/RAC/Classification.pdf"},
    "session": {"id": "5ecc9282-1135-4611-aa64-fe4ecc512cfd", "type": "RAC", "date": "2026-07-12T14:00:00+00:00", "status": "FINISHED"},
}


@pytest.fixture()
def client() -> MotoGPClient:
    return MotoGPClient()


def test_get_classification_parses_real_response_shape(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v2/results/classifications",
            json=CLASSIFICATION_RESPONSE,
        )
        entries = client._classifications.get("session-uuid-x")

    assert len(entries) == 3
    assert entries[0].position == 1
    assert entries[0].rider_name == "Marc Marquez"
    assert entries[0].team_name == "Ducati Lenovo Team"
    assert entries[0].time == "40:53.148"
    assert entries[0].gap_to_leader == "0.000"
    assert entries[0].points == 25


def test_get_classification_handles_retired_rider() -> None:
    from motogp_client.models import ClassificationEntry

    entry = ClassificationEntry.model_validate(CLASSIFICATION_ENTRIES[2])

    assert entry.position is None
    assert entry.status == "OUTSTND"
    assert entry.rider_name == "Maverick Viñales"


def test_get_classification_handles_plain_list_response(client: MotoGPClient) -> None:
    """Por robustez, si la API alguna vez devolviera la lista sin envoltorio."""
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v2/results/classifications",
            json=CLASSIFICATION_ENTRIES,
        )
        entries = client._classifications.get("session-uuid-x")

    assert len(entries) == 3
    assert entries[0].rider_name == "Marc Marquez"


def test_get_classification_sends_expected_params(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v2/results/classifications",
            json={"classification": []},
        )
        client._classifications.get("session-uuid-x")

    assert m.last_request.qs == {"session": ["session-uuid-x"], "test": ["false"]}
