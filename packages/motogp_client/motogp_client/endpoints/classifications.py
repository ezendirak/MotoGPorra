"""Endpoint de clasificaciones de una sesión.

Puramente interno. Dado un ``session_uuid`` (resuelto por
``sessions.py``), obtiene la clasificación completa de esa sesión.

Documentación de terceros sobre esta misma API
(https://github.com/robschmitt/MotoGP-API, endpoint equivalente de
clasificación) muestra la lista anidada bajo la clave
``"classification"`` junto a metadatos (``"file"``, ``"files"``). Se
mantiene además el soporte para una lista plana como fallback
defensivo, por si esa ruta v1 y la ruta v2 verificada en tu
documentación difirieran en este detalle.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..models import ClassificationEntry

if TYPE_CHECKING:
    from ..client import MotoGPClient


class ClassificationsEndpoint:
    """Acceso interno a la clasificación de una sesión."""

    def __init__(self, client: "MotoGPClient") -> None:
        self._client = client

    def get(self, session_uuid: str) -> list[ClassificationEntry]:
        """Devuelve la clasificación completa de la sesión indicada."""
        raw: Any = self._client._get(
            "v2/results/classifications",
            params={"session": session_uuid, "test": "false"},
        )

        items = raw.get("classification", []) if isinstance(raw, dict) else raw
        items = items or []

        return [ClassificationEntry.model_validate(item) for item in items]
