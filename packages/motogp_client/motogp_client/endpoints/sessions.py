"""Endpoint de sesiones de un evento.

Puramente interno: nada de este módulo se expone en la API pública del
cliente. Su función es, dado un ``event_uuid`` y un ``category_uuid``
ya resueltos, listar las sesiones disponibles (FP1, FP2, PR, Q1, Q2,
SPR, WUP, RAC) y localizar la que interesa por su tipo.

También resuelve el ``category_uuid`` que necesita ``list()``: la API
de resultados usa, para las categorías, un espacio de UUIDs *distinto*
del que devuelve el calendario (``GET /v1/events`` → ``Category.id``).
Confirmado con una llamada real: para el GP de Alemania 2026, la
categoría MotoGP tiene ``id`` ``93888447-8746-4161-882c-e08a1d48447e``
en el calendario, pero ``GET /v1/results/sessions`` solo acepta como
``categoryUuid`` el ``e8c110ad-64aa-4e8e-8a86-f2f152f6a942`` que
devuelve ``GET /v1/results/categories?eventUuid=...`` para ese mismo
evento — cualquier otro valor responde 404
``{"error_type": "category_not_found"}``. De ahí que ``resolve_category_uuid``
haga esa segunda consulta en vez de reutilizar directamente el
``Category.id`` ya resuelto por ``events.py``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..exceptions import InvalidCategoryError, InvalidSessionError
from ..models import Category, Session
from ..utils import find_best_match

if TYPE_CHECKING:
    from ..client import MotoGPClient


class SessionsEndpoint:
    """Acceso interno a sesiones de un evento/categoría."""

    def __init__(self, client: "MotoGPClient") -> None:
        self._client = client

    def resolve_category_uuid(self, event_uuid: str, category_name: str) -> str:
        """Resuelve un nombre de categoría (p.ej. ``"MotoGP"``) al UUID de
        categoría específico de la API de resultados para ``event_uuid``.

        Ver la nota del módulo sobre por qué este UUID no es el mismo que
        ``Category.id`` en el calendario.

        Raises:
            InvalidCategoryError: Si ninguna categoría de resultados de
                este evento coincide con ``category_name``.
        """
        raw: list[dict[str, Any]] = self._client._get(
            "v1/results/categories", params={"eventUuid": event_uuid}
        )
        categories = [Category.model_validate(item) for item in raw]

        match = find_best_match(categories, category_name, text_fn=lambda c: c.name)
        if match is None:
            available = ", ".join(c.name for c in categories) or "ninguna"
            raise InvalidCategoryError(
                f"La categoría '{category_name}' no tiene resultados para "
                f"este evento. Categorías disponibles: {available}"
            )
        return match.id

    def list(self, event_uuid: str, category_uuid: str) -> list[Session]:
        """Lista las sesiones de un evento para una categoría concreta.

        Args:
            category_uuid: UUID de categoría de la API de *resultados*
                (ver :meth:`resolve_category_uuid`), no el ``Category.id``
                del calendario.
        """
        raw: list[dict[str, Any]] = self._client._get(
            "v1/results/sessions",
            params={"eventUuid": event_uuid, "categoryUuid": category_uuid},
        )
        return [Session.model_validate(item) for item in raw]

    @staticmethod
    def find_by_type(sessions: list[Session], session_type: str) -> Session:
        """Localiza, entre ``sessions``, la de tipo ``session_type``
        (p.ej. ``"RAC"``, ``"SPR"``). Comparación exacta e insensible a
        mayúsculas: los códigos de sesión están estandarizados, a
        diferencia de los nombres de evento, así que no hace falta
        matching difuso aquí.

        Raises:
            InvalidSessionError: Si ninguna sesión coincide.
        """
        target = session_type.strip().upper()
        for session in sessions:
            if (session.type or "").strip().upper() == target:
                return session

        available = ", ".join(sorted({s.type or "?" for s in sessions})) or "ninguna"
        raise InvalidSessionError(
            f"No se encontró una sesión de tipo '{session_type}'. "
            f"Sesiones disponibles: {available}"
        )
