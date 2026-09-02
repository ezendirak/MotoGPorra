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


# ---------------------------------------------------------------------------
# Detalle de piloto e imágenes.
#
# El fixture reproduce la forma REAL de GET /v1/riders/{id} (medida contra la
# API en 2026): no hay `current_career_step`, sino `career`, y las imágenes de
# la temporada en curso llegan a medias.
# ---------------------------------------------------------------------------

DETALLE_BAGNAIA = {
    "id": "66b78301-5826-4986-b11e-fa68a7bd77a7",
    "name": "Francesco",
    "surname": "Bagnaia",
    "legacy_id": 8273,
    "country": {"iso": "IT", "name": "Italy"},
    "career": [
        {
            "season": 2026,
            "number": 63,
            "current": True,
            "category": {"id": "cat-motogp", "name": "MotoGP"},
            "pictures": {
                "profile": {"main": "https://photos/2026/perfil.png", "secondary": None},
                "bike": {"main": None, "secondary": None},
                "helmet": {"main": None, "secondary": None},
                "number": None,
                "portrait": None,
            },
        },
        {
            "season": 2025,
            "number": 63,
            "current": False,
            "category": {"id": "cat-motogp", "name": "MotoGP"},
            "pictures": {
                "profile": {"main": "https://photos/2025/perfil.png", "secondary": None},
                "bike": {"main": "https://photos/2025/moto.png", "secondary": None},
                "number": "https://photos/2025/number/63.png",
            },
        },
        {
            # Su año de campeón, con el dorsal 1: NO debe heredarse.
            "season": 2024,
            "number": 1,
            "current": False,
            "category": {"id": "cat-motogp", "name": "MotoGP"},
            "pictures": {"number": "https://photos/2024/number/1.png"},
        },
    ],
}


def _detalle(client: MotoGPClient, payload: dict) -> "object":
    url = f"https://api.pulselive.motogp.com/motogp/v1/riders/{payload['id']}"
    with rm_module.Mocker() as m:
        m.get(url, json=payload)
        return client.get_rider_detail(payload["id"])


def test_rider_detail_deduces_current_step_from_career(client: MotoGPClient) -> None:
    rider = _detalle(client, DETALLE_BAGNAIA)

    assert rider.current_career_step is None
    assert rider.current_step is not None
    assert rider.current_step.season == 2026
    assert rider.number == 63
    assert rider.category_name == "MotoGP"
    assert rider.is_active is True


def test_picture_url_prefers_current_season(client: MotoGPClient) -> None:
    rider = _detalle(client, DETALLE_BAGNAIA)

    assert rider.picture_url("profile") == "https://photos/2026/perfil.png"


def test_picture_url_falls_back_to_previous_season(client: MotoGPClient) -> None:
    rider = _detalle(client, DETALLE_BAGNAIA)

    # 2026 trae `bike.main` a null; la más reciente que sí la tiene es 2025.
    assert rider.picture_url("bike") == "https://photos/2025/moto.png"


def test_picture_url_without_fallback_stays_in_current_season(
    client: MotoGPClient,
) -> None:
    rider = _detalle(client, DETALLE_BAGNAIA)

    assert rider.picture_url("bike", fallback=False) is None


def test_number_picture_ignores_seasons_with_another_number(
    client: MotoGPClient,
) -> None:
    """Bagnaia corrió con el 1 en 2024 y con el 63 antes y después.

    Sin esta comprobación, la app enseñaría el dorsal de campeón a un piloto
    que hoy lleva otro número. Es un caso real, no hipotético.
    """
    rider = _detalle(client, DETALLE_BAGNAIA)

    assert rider.picture_url("number") == "https://photos/2025/number/63.png"


def test_number_picture_returns_none_when_no_season_matches(
    client: MotoGPClient,
) -> None:
    payload = {
        "id": "novato",
        "name": "Un",
        "surname": "Novato",
        "career": [
            {"season": 2026, "number": 7, "current": True, "pictures": {}},
            {"season": 2025, "number": 54, "pictures": {"number": "https://x/54.png"}},
        ],
    }
    rider = _detalle(client, payload)

    assert rider.picture_url("number") is None


def test_rider_from_listing_still_exposes_pictures(client: MotoGPClient) -> None:
    """El listado también trae imágenes; ahí no hay `career` al que recurrir."""
    listado = [
        {
            "id": "r1",
            "name": "Johann",
            "surname": "Zarco",
            "current_career_step": {
                "season": 2026,
                "number": 5,
                "current": True,
                "category": {"id": "c", "name": "MotoGP"},
                "pictures": {
                    "profile": {"main": "https://photos/2026/zarco.png"},
                    "number": "https://photos/number/5.png",
                },
            },
        }
    ]
    with rm_module.Mocker() as m:
        m.get("https://api.pulselive.motogp.com/motogp/v1/riders", json=listado)
        riders = client.get_riders(category="MotoGP")

    assert riders[0].picture_url("profile") == "https://photos/2026/zarco.png"
    assert riders[0].picture_url("number") == "https://photos/number/5.png"
    assert riders[0].picture_url("helmet") is None
