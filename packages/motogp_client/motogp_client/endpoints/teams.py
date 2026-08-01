"""Endpoint de equipos.

ATENCIÓN: a diferencia de ``events``, ``riders``, ``sessions`` y
``classifications``, la ruta ``GET /v1/teams`` **no** venía en la
documentación verificada de la API — se asume por analogía con
``/v1/riders``. Antes de usar esto en producción, confirma la ruta
real inspeccionando las llamadas de motogp.com en DevTools y ajusta
``_TEAMS_PATH`` si hace falta.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..models import Team

if TYPE_CHECKING:
    from ..client import MotoGPClient

_TEAMS_PATH = "v1/teams"  # TODO: verificar contra la API real


class TeamsEndpoint:
    """Acceso de alto nivel a equipos."""

    def __init__(self, client: "MotoGPClient") -> None:
        self._client = client

    def list(self, category: str | None = None) -> list[Team]:
        """Devuelve los equipos, opcionalmente filtrados por categoría.

        Args:
            category: Nombre de categoría (p.ej. ``"MotoGP"``). Si se
                omite, devuelve equipos de todas las categorías.
        """
        raw: list[dict[str, Any]] = self._client._get(_TEAMS_PATH)
        teams = [Team.model_validate(item) for item in raw]

        if category is None:
            return teams

        target = category.strip().casefold()
        return [
            team
            for team in teams
            if team.category_name and team.category_name.strip().casefold() == target
        ]
