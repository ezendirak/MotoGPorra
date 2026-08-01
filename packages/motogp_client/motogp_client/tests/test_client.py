"""Tests unitarios de MotoGPClient._get.

No se realiza ninguna petición real: toda la comunicación HTTP se
mockea con `requests_mock`.
"""

from __future__ import annotations

import requests
import requests_mock as rm_module
import pytest

from motogp_client.client import MotoGPClient
from motogp_client.config import MotoGPConfig
from motogp_client.exceptions import (
    ApiError,
    MotoGPTimeoutError,
    NetworkError,
    NotFoundError,
)


@pytest.fixture()
def client() -> MotoGPClient:
    config = MotoGPConfig(base_url="https://api.pulselive.motogp.com/motogp")
    return MotoGPClient(config=config)


def test_get_returns_parsed_json(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events",
            json=[{"id": "abc", "name": "Germany"}],
        )

        result = client._get("v1/events", params={"seasonYear": 2026})

    assert result == [{"id": "abc", "name": "Germany"}]


def test_get_sends_query_params(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events",
            json=[],
        )

        client._get("v1/events", params={"seasonYear": 2026})

        assert m.last_request is not None
        assert m.last_request.qs == {"seasonyear": ["2026"]}


def test_get_strips_slashes_when_building_url(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/riders",
            json=[],
        )

        # endpoint con barra inicial, base_url con barra final
        client._config = MotoGPConfig(
            base_url="https://api.pulselive.motogp.com/motogp/"
        )
        client._get("/v1/riders")

        assert m.last_request is not None


def test_get_raises_not_found_on_404(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/riders/unknown",
            status_code=404,
            text="not found",
        )

        with pytest.raises(NotFoundError) as exc_info:
            client._get("v1/riders/unknown")

    assert exc_info.value.status_code == 404


def test_get_raises_api_error_on_5xx(client: MotoGPClient) -> None:
    config = MotoGPConfig(max_retries=0)
    client = MotoGPClient(config=config)

    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events",
            status_code=500,
            text="server error",
        )

        with pytest.raises(ApiError) as exc_info:
            client._get("v1/events")

    assert exc_info.value.status_code == 500


def test_get_raises_api_error_on_invalid_json(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events",
            text="<html>not json</html>",
            headers={"Content-Type": "text/html"},
        )

        with pytest.raises(ApiError):
            client._get("v1/events")


def test_get_raises_timeout_error(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events",
            exc=requests.exceptions.Timeout,
        )

        with pytest.raises(MotoGPTimeoutError):
            client._get("v1/events")


def test_get_raises_network_error_on_connection_error(client: MotoGPClient) -> None:
    with rm_module.Mocker() as m:
        m.get(
            "https://api.pulselive.motogp.com/motogp/v1/events",
            exc=requests.exceptions.ConnectionError,
        )

        with pytest.raises(NetworkError):
            client._get("v1/events")


def test_config_defaults() -> None:
    config = MotoGPConfig()

    assert config.base_url == "https://api.pulselive.motogp.com/motogp"
    assert config.timeout == 10.0
    assert config.max_retries == 3
    assert config.enable_cache is False


def test_config_rejects_invalid_timeout() -> None:
    with pytest.raises(Exception):
        MotoGPConfig(timeout=0)


def test_client_context_manager_closes_session() -> None:
    closed = {"value": False}

    with MotoGPClient() as client:
        original_close = client._session.close

        def tracking_close() -> None:
            closed["value"] = True
            original_close()

        client._session.close = tracking_close  # type: ignore[method-assign]

    assert closed["value"] is True
