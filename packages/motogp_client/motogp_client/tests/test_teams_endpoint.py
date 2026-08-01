from __future__ import annotations

import requests_mock as rm_module
import pytest

from motogp_client.client import MotoGPClient

TEAMS = [
    {
        "id": "team-1",
        "name": "Ducati Lenovo Team",
        "constructor": {"id": "ducati", "name": "Ducati"},
        "category": {"id": "cat-motogp", "name": "MotoGP"},
    },
    {
        "id": "team-2",
        "name": "Some Moto2 Team",
        "constructor": {"id": "kalex", "name": "Kalex"},
        "category": {"id": "cat-moto2", "name": "Moto2"},
    },
]


@pytest.fixture()
def client() -> MotoGPClient:
    return MotoGPClient()


def test_get_teams_without_filter_returns_all(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get("https://api.pulselive.motogp.com/motogp/v1/teams", json=TEAMS)
        teams = client.get_teams()

    assert len(teams) == 2


def test_get_teams_filters_by_category(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get("https://api.pulselive.motogp.com/motogp/v1/teams", json=TEAMS)
        teams = client.get_teams(category="MotoGP")

    assert len(teams) == 1
    assert teams[0].constructor is not None
    assert teams[0].constructor.name == "Ducati"
