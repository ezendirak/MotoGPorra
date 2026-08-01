"""Endpoint de eventos (calendario y detalle de Grandes Premios).

Responsabilidades de este módulo:

- Listar el calendario de una temporada (``GET /v1/events``).
- Obtener el detalle completo de un evento (``GET /v1/events/{id}``),
  que es lo que expone ``results_api.eventUuid``.
- Resolver un número de "round" (p.ej. ``11``) al evento correspondiente,
  sin que el resto de la librería tenga que iterar el calendario.
- Resolver el nombre de una categoría (p.ej. ``"MotoGP"``) a su
  ``Category`` dentro de un evento concreto.

Este módulo no sabe nada de sesiones ni clasificaciones: esa lógica
vive en ``sessions.py`` y ``classifications.py``, que se apoyan en
``EventsEndpoint.get_by_round()`` para obtener el ``event_uuid`` de
partida.

Nota sobre "round": la API no documenta (que sepamos) un campo
explícito de número de ronda. Por eso ``get_by_round`` primero busca un
campo así entre los que la API pueda estar devolviendo sin documentar
(``number``, ``round``, ``sequence``) y, si no lo encuentra, usa la
posición del evento dentro del calendario (solo entre Grandes Premios
reales, ver :meth:`EventsEndpoint.list_races`) como número de ronda. Si en el futuro se confirma el nombre real del
campo, basta con ajustar ``_EXPLICIT_ROUND_KEYS``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..exceptions import InvalidCategoryError, NotFoundError
from ..models import Category, Event
from ..utils import find_best_match

if TYPE_CHECKING:
    from ..client import MotoGPClient

_EXPLICIT_ROUND_KEYS = ("number", "round", "sequence")


def _explicit_round_number(event: Event) -> int | None:
    """Busca un número de ronda explícito entre los campos no modelados."""
    for key in _EXPLICIT_ROUND_KEYS:
        value = event.raw.get(key)
        if isinstance(value, int):
            return value
    return None


class EventsEndpoint:
    """Acceso de alto nivel a eventos (Grandes Premios)."""

    def __init__(self, client: "MotoGPClient") -> None:
        self._client = client

    def list(self, season: int) -> list[Event]:
        """Devuelve el calendario completo de una temporada.

        Args:
            season: Año de la temporada (p.ej. ``2026``).
        """
        raw: list[dict[str, Any]] = self._client._get(
            "v1/events", params={"seasonYear": season}
        )
        return [Event.model_validate(item) for item in raw]

    def list_races(self, season: int) -> list[Event]:
        """Calendario de la temporada, solo con Grandes Premios reales.

        El calendario devuelto por ``v1/events`` también incluye tests
        de pretemporada (``kind == "TEST"``) y eventos promocionales sin
        resultados (``kind == "MEDIA"``, p.ej. presentaciones de equipo
        o el "World Ducati Week"). Ninguno de los dos tiene
        ``event_uuid`` de resultados, así que se filtra por
        :attr:`Event.is_race` en vez de solo excluir los de test.

        Es la lista sobre la que se calcula la posición usada como
        número de ronda cuando la API no da un campo explícito.
        """
        return [event for event in self.list(season) if event.is_race]

    def get_detail(self, event_id: str) -> Event:
        """Devuelve el detalle completo de un evento a partir de su ``id``.

        El resultado incluye ``event_uuid`` (vía ``results_api``), necesario
        para consultar sesiones y clasificaciones.
        """
        raw: dict[str, Any] = self._client._get(f"v1/events/{event_id}")
        return Event.model_validate(raw)

    def get_by_round(self, season: int, round_number: int) -> Event:
        """Resuelve un número de ronda al detalle completo del evento.

        Ver la nota del módulo sobre cómo se calcula el "round".

        Raises:
            NotFoundError: Si no existe esa ronda en la temporada.
        """
        races = self.list_races(season)

        for event in races:
            if _explicit_round_number(event) == round_number:
                return self.get_detail(event.id)

        if 1 <= round_number <= len(races):
            return self.get_detail(races[round_number - 1].id)

        raise NotFoundError(
            f"No existe el round {round_number} en la temporada {season} "
            f"(la temporada tiene {len(races)} carreras)"
        )

    @staticmethod
    def resolve_category(event: Event, category: str) -> Category:
        """Resuelve un nombre de categoría (p.ej. ``"Motogp"``) a la
        ``Category`` exacta del evento, tolerando pequeñas variaciones
        de mayúsculas/espacios mediante matching difuso.

        Raises:
            InvalidCategoryError: Si ninguna categoría del evento coincide.
        """
        match = find_best_match(
            event.categories, category, text_fn=lambda c: c.name
        )
        if match is None:
            available = ", ".join(c.name for c in event.categories) or "ninguna"
            raise InvalidCategoryError(
                f"La categoría '{category}' no existe para el evento "
                f"'{event.name}'. Categorías disponibles: {available}"
            )
        return match
