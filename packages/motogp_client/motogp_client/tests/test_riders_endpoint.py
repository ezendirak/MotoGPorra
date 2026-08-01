"""Tests de RidersEndpoint / MotoGPClient.get_riders.

Los fixtures usan la forma de respuesta real documentada en
https://github.com/robschmitt/MotoGP-API (sección "Get Riders"):
nombre y apellido separados (``name``/``surname``), y categoría/equipo
anidados bajo ``current_career_step``.
"""

from __future__ import annotations

import requests_mock as rm_module
import pytest

from motogp_client.client import MotoGPClient

RIDERS = [
    {
        "id": "66b78301-5826-4986-b11e-fa68a7bd77a7",
        "name": "Francesco",
        "surname": "Bagnaia",
        "nickname": None,
        "legacy_id": 8273,
        "country": {"iso": "IT", "name": "Italy"},
        "current_career_step": {
            "season": 2026,
            "number": 1,
            "sponsored_team": "Ducati Lenovo Team",
            "team": {
                "id": "892fff2f-7402-4fbd-99fb-5fd567d8a80c",
                "name": "Ducati Lenovo Team",
                "constructor": {"id": "ducati", "name": "Ducati"},
            },
            "category": {"id": "cat-motogp", "name": "MotoGP"},
            "current": True,
        },
    },
    {
        "id": "some-moto2-rider-id",
        "name": "Some",
        "surname": "Moto2Rider",
        "legacy_id": 1234,
        "country": {"iso": "IT", "name": "Italy"},
        "current_career_step": {
            "season": 2026,
            "number": 21,
            "team": {"id": "team-moto2", "name": "Some Moto2 Team"},
            "category": {"id": "cat-moto2", "name": "Moto2"},
            "current": True,
        },
    },
]


@pytest.fixture()
def client() -> MotoGPClient:
    return MotoGPClient()


def test_get_riders_without_filter_returns_all(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get("https://api.pulselive.motogp.com/motogp/v1/riders", json=RIDERS)
        riders = client.get_riders()

    assert len(riders) == 2


def test_rider_full_name_combines_name_and_surname(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get("https://api.pulselive.motogp.com/motogp/v1/riders", json=RIDERS)
        riders = client.get_riders()

    assert riders[0].full_name == "Francesco Bagnaia"


def test_get_riders_filters_by_category_nested_in_career_step(
    client: MotoGPClient,
) -> None:
    with rm_module.Mocker() as m:
        m.get("https://api.pulselive.motogp.com/motogp/v1/riders", json=RIDERS)
        riders = client.get_riders(category="MotoGP")

    assert len(riders) == 1
    assert riders[0].full_name == "Francesco Bagnaia"
    assert riders[0].team_name == "Ducati Lenovo Team"
    assert riders[0].number == 1


def test_get_riders_filter_is_case_insensitive(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get("https://api.pulselive.motogp.com/motogp/v1/riders", json=RIDERS)
        riders = client.get_riders(category="motogp")

    assert len(riders) == 1


def test_rider_with_missing_career_step_does_not_crash() -> None:
    from motogp_client.models import Rider

    rider = Rider.model_validate({"id": "x", "name": "Solo Nombre"})

    assert rider.full_name == "Solo Nombre"
    assert rider.category_name is None
    assert rider.team_name is None
    assert rider.number is None
