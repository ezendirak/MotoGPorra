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

    def get(self, rider_id: str) -> Rider:
        """Ficha completa de un piloto (``GET /v1/riders/{id}``).

        Frente al listado, añade ``career``: el historial temporada a
        temporada, cada una con su equipo, su dorsal y **sus imágenes**. Es la
        única vía de recuperar el dorsal, la moto o el casco de un piloto cuya
        temporada en curso todavía no los tiene publicados.

        A cambio no trae ``current_career_step``, así que el modelo deduce la
        temporada vigente desde ``career`` (ver :attr:`Rider.current_step`).

        Args:
            rider_id: ``id`` del piloto, tal y como lo devuelve :meth:`list`.

        Raises:
            NotFoundError: Si el piloto no existe.
        """
        raw: dict[str, Any] = self._client._get(f"v1/riders/{rider_id}")
        return Rider.model_validate(raw)
