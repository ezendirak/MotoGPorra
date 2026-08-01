"""Endpoint de pilotos.

``GET /v1/riders`` devuelve todos los pilotos de todas las categorías
en una sola llamada; el filtrado por categoría se hace en cliente
(la API no ofrece, según la documentación disponible, un parámetro de
filtrado por categoría en este endpoint).

Forma de la respuesta verificada contra documentación de terceros
(https://github.com/robschmitt/MotoGP-API) — ver docstring de
:class:`motogp_client.models.Rider` para el detalle.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..models import Rider

if TYPE_CHECKING:
    from ..client import MotoGPClient


class RidersEndpoint:
    """Acceso de alto nivel a pilotos."""

    def __init__(self, client: "MotoGPClient") -> None:
        self._client = client

    def list(self, category: str | None = None) -> list[Rider]:
        """Devuelve los pilotos, opcionalmente filtrados por categoría.

        Args:
            category: Nombre de categoría (p.ej. ``"MotoGP"``). Si se
                omite, devuelve pilotos de todas las categorías.
        """
        raw: list[dict[str, Any]] = self._client._get("v1/riders")
        riders = [Rider.model_validate(item) for item in raw]

        if category is None:
            return riders

        target = category.strip().casefold()
        return [
            rider
            for rider in riders
            if rider.category_name and rider.category_name.strip().casefold() == target
        ]
