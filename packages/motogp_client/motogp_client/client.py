"""Cliente principal de la librería.

Combina dos responsabilidades, deliberadamente separadas dentro de
esta misma clase:

1. **Núcleo HTTP** (:meth:`_get` y todo lo relacionado con la sesión de
   `requests`): construir la sesión, ejecutar peticiones y traducir
   errores de `requests` a las excepciones propias de la librería.

2. **API pública de alto nivel**, orientada a los dos flujos de
   sincronización de la aplicación consumidora:

   - Sincronización inicial/periódica: :meth:`get_calendar_current`,
     :meth:`get_riders`, :meth:`get_teams`.
   - Sincronización de resultados: :meth:`get_race_results`,
     :meth:`get_latest_race_results`, :meth:`get_completed_race_results`.

Los sub-endpoints (``self._events``, ``self._riders``, ``self._teams``,
``self._sessions``, ``self._classifications``) son un detalle interno:
no forman parte del contrato público de la librería. Quien use
``MotoGPClient`` nunca necesita saber qué es un ``eventUuid``, un
``categoryUuid`` o un ``sessionUuid``.
"""

from __future__ import annotations

import logging
from datetime import date
from types import TracebackType
from typing import Any, Iterable, Iterator

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .config import MotoGPConfig
from .endpoints.classifications import ClassificationsEndpoint
from .endpoints.events import EventsEndpoint
from .endpoints.riders import RidersEndpoint
from .endpoints.sessions import SessionsEndpoint
from .endpoints.teams import TeamsEndpoint
from .exceptions import (
    ApiError,
    InvalidCategoryError,
    InvalidSessionError,
    MotoGPError,
    MotoGPTimeoutError,
    NetworkError,
    NotFoundError,
)
from .models import Event, RaceResult, Rider, Session, Team

logger = logging.getLogger(__name__)


class MotoGPClient:
    """Cliente de la API interna de MotoGP, con una API pública orientada
    a los casos de uso reales de la aplicación consumidora.

    Example:
        >>> with MotoGPClient() as client:
        ...     calendar = client.get_calendar_current()
        ...     riders = client.get_riders(category="MotoGP")
        ...     result = client.get_race_results(round=11, category="MotoGP")
        ...     print(result.podium)
    """

    def __init__(self, config: MotoGPConfig | None = None) -> None:
        self._config = config or MotoGPConfig()
        self._session = self._build_session()

        # Sub-endpoints internos, compuestos sobre este mismo cliente HTTP.
        # Deliberadamente con prefijo `_`: no son parte de la API pública.
        self._events = EventsEndpoint(self)
        self._riders = RidersEndpoint(self)
        self._teams = TeamsEndpoint(self)
        self._sessions = SessionsEndpoint(self)
        self._classifications = ClassificationsEndpoint(self)

    # -- construcción / ciclo de vida -----------------------------------

    def _build_session(self) -> requests.Session:
        """Crea la sesión HTTP con cabeceras y política de reintentos."""
        session = requests.Session()
        session.headers.update(
            {
                "User-Agent": self._config.user_agent,
                "Accept": "application/json",
            }
        )

        if self._config.max_retries > 0:
            retry = Retry(
                total=self._config.max_retries,
                backoff_factor=self._config.backoff_factor,
                status_forcelist=(500, 502, 503, 504),
                allowed_methods=("GET",),
                raise_on_status=False,
            )
            adapter = HTTPAdapter(max_retries=retry)
            session.mount("https://", adapter)
            session.mount("http://", adapter)

        return session

    def close(self) -> None:
        """Cierra la sesión HTTP subyacente."""
        self._session.close()

    def __enter__(self) -> "MotoGPClient":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()

    # -- núcleo HTTP -------------------------------------------------------

    def _build_url(self, endpoint: str) -> str:
        base = self._config.base_url.rstrip("/")
        path = endpoint.lstrip("/")
        return f"{base}/{path}"

    def _get(self, endpoint: str, params: dict[str, Any] | None = None) -> Any:
        """Ejecuta un GET contra la API y devuelve el JSON ya parseado.

        Args:
            endpoint: Ruta relativa a ``base_url`` (p.ej. ``"v1/events"``).
            params: Parámetros de query string opcionales.

        Returns:
            El cuerpo de la respuesta ya deserializado desde JSON (dict o list).

        Raises:
            NotFoundError: Si la API responde 404.
            ApiError: Si la API responde con cualquier otro código de error,
                o si la respuesta no es JSON válido.
            NetworkError: Si falla la conexión antes de recibir respuesta.
            MotoGPTimeoutError: Si se supera el timeout configurado.
        """
        url = self._build_url(endpoint)
        logger.debug("GET %s params=%s", url, params)

        try:
            response = self._session.get(
                url, params=params, timeout=self._config.timeout
            )
        except requests.exceptions.Timeout as exc:
            raise MotoGPTimeoutError(f"Timeout al solicitar {url}") from exc
        except requests.exceptions.ConnectionError as exc:
            raise NetworkError(f"Error de conexión al solicitar {url}") from exc
        except requests.exceptions.RequestException as exc:
            raise NetworkError(f"Error de red inesperado al solicitar {url}") from exc

        self._raise_for_status(response, url)

        try:
            return response.json()
        except ValueError as exc:
            raise ApiError(
                f"Respuesta no es JSON válido desde {url}",
                status_code=response.status_code,
                response_body=response.text,
            ) from exc

    @staticmethod
    def _raise_for_status(response: requests.Response, url: str) -> None:
        if response.status_code == 404:
            raise NotFoundError(
                f"Recurso no encontrado: {url}",
                status_code=404,
                response_body=response.text,
            )
        if not response.ok:
            raise ApiError(
                f"La API respondió con error {response.status_code} para {url}",
                status_code=response.status_code,
                response_body=response.text,
            )

    # -- API pública: sincronización inicial / periódica -------------------

    def get_calendar_current(self) -> list[Event]:
        """Calendario de Grandes Premios de la temporada en curso.

        Solo incluye carreras reales (``kind == "GP"``): quedan fuera los
        tests de pretemporada y los eventos promocionales sin resultados
        (``kind == "MEDIA"``, p.ej. presentaciones de equipo o el "World
        Ducati Week"). Ver :meth:`EventsEndpoint.list_races`.
        """
        return self._events.list_races(self._current_season())

    def get_riders(self, category: str | None = None) -> list[Rider]:
        """Todos los pilotos, opcionalmente filtrados por categoría.

        Args:
            category: p.ej. ``"MotoGP"``. Si se omite, devuelve pilotos
                de todas las categorías.
        """
        return self._riders.list(category=category)

    def get_teams(self, category: str | None = None) -> list[Team]:
        """Todos los equipos, opcionalmente filtrados por categoría.

        Args:
            category: p.ej. ``"MotoGP"``. Si se omite, devuelve equipos
                de todas las categorías.
        """
        return self._teams.list(category=category)

    def get_event_sessions(self, event_id: str, category: str) -> list[Session]:
        """Sesiones de un Gran Premio para una categoría, ordenadas por fecha.

        Devuelve las 8 sesiones del fin de semana (FP1, PR, FP2, Q1, Q2, SPR,
        WUP, RAC) con su hora de inicio **en UTC**.

        Encapsula la cadena interna ``events/{id}`` → ``results/categories``
        → ``results/sessions``, que hasta ahora solo existía dentro de
        :meth:`_build_race_result`. Sin este método, un consumidor que
        necesitara los horarios tendría que usar los sub-endpoints privados
        del cliente, rompiendo el encapsulamiento que justifica esta librería.

        Args:
            event_id: ``id`` del evento tal y como lo devuelve
                :meth:`get_calendar_current`.
            category: p.ej. ``"MotoGP"``.

        Returns:
            Las sesiones ordenadas cronológicamente. Las que no tengan fecha
            se colocan al final en vez de romper la ordenación.

        Raises:
            NotFoundError: Si el evento no existe.
            InvalidCategoryError: Si el evento no tiene esa categoría.
            MotoGPError: Si el evento no expone ``event_uuid`` de resultados
                (ocurre con tests y eventos promocionales).
        """
        event = self._events.get_detail(event_id)

        if event.event_uuid is None:
            raise MotoGPError(
                f"El evento '{event.name}' no tiene event_uuid de resultados: "
                "es un test o un evento promocional, no un Gran Premio."
            )

        resolved_category = self._events.resolve_category(event, category)
        category_uuid = self._sessions.resolve_category_uuid(
            event.event_uuid, resolved_category.name
        )
        sessions = self._sessions.list(event.event_uuid, category_uuid)

        return sorted(
            sessions,
            key=lambda s: (s.date is None, s.date),
        )

    # -- API pública: sincronización de resultados --------------------------

    def get_race_results(self, round: int, category: str) -> RaceResult:
        """Resultados oficiales de carrera de un Gran Premio concreto.

        Args:
            round: Número de ronda dentro de la temporada en curso
                (p.ej. ``11``). Ver ``endpoints/events.py`` para cómo se
                calcula si la API no expone un número de ronda explícito.
            category: p.ej. ``"MotoGP"``.

        Returns:
            Un :class:`~motogp_client.models.RaceResult` con la
            clasificación completa; ``.podium`` da acceso directo al top 3.
        """
        season = self._current_season()
        event = self._events.get_by_round(season, round)
        return self._build_race_result(
            event, category=category, session_type="RAC", round_number=round
        )

    def get_latest_race_results(self, category: str) -> RaceResult:
        """Resultados oficiales del último Gran Premio ya disputado.

        Recorre el calendario de la temporada en curso de más reciente a
        más antiguo y devuelve el primer evento para el que exista
        clasificación de carrera en la categoría indicada.

        Raises:
            NotFoundError: Si ningún evento de la temporada tiene
                resultados disponibles para esa categoría.
        """
        season = self._current_season()
        races = self._events.list_races(season)
        indexed_races = reversed(list(enumerate(races, start=1)))

        for result in self._iter_finished_race_results(indexed_races, category):
            return result

        raise NotFoundError(
            f"No se encontraron resultados de carrera para la categoría "
            f"'{category}' en la temporada {season}"
        )

    def get_completed_race_results(self, category: str) -> list[RaceResult]:
        """Resultados oficiales de todos los Grandes Premios ya disputados
        en la temporada en curso, en orden cronológico (round 1 primero).

        Recorre el calendario completo y descarta silenciosamente los
        eventos que aún no tienen clasificación de carrera para la
        categoría indicada (carreras futuras, o sin esa categoría). Si
        ninguna carrera se ha disputado todavía, devuelve una lista vacía.
        """
        season = self._current_season()
        races = self._events.list_races(season)
        indexed_races = enumerate(races, start=1)

        return list(self._iter_finished_race_results(indexed_races, category))

    # -- orquestación interna ---------------------------------------------

    def _iter_finished_race_results(
        self,
        indexed_races: Iterable[tuple[int, Event]],
        category: str,
    ) -> Iterator[RaceResult]:
        """Recorre ``indexed_races`` (pares ``(round_number, Event)``, ya en
        el orden deseado por el llamante) y va produciendo el
        :class:`~motogp_client.models.RaceResult` de cada evento que ya
        tenga clasificación de carrera para ``category``.

        Descarta silenciosamente los eventos sin esa categoría o sesión
        (``InvalidCategoryError``, ``InvalidSessionError``), los que aún no
        tienen detalle/resultados publicados (``NotFoundError``), y los que
        ya aparecen en el calendario de sesiones pero cuya clasificación
        todavía está vacía por no haberse disputado (ver
        :meth:`get_latest_race_results`).
        """
        for position, summary in indexed_races:
            try:
                event = self._events.get_detail(summary.id)
                result = self._build_race_result(
                    event,
                    category=category,
                    session_type="RAC",
                    round_number=position,
                )
            except (NotFoundError, InvalidCategoryError, InvalidSessionError):
                continue

            if result.classification:
                yield result

    def _build_race_result(
        self,
        event: Event,
        *,
        category: str,
        session_type: str,
        round_number: int | None,
    ) -> RaceResult:
        """Encadena events → sessions → classifications para un evento ya
        resuelto, y arma el `RaceResult` final. Aquí es donde vive el
        flujo interno completo; nada de esto se expone públicamente.
        """
        if event.event_uuid is None:
            raise MotoGPError(
                f"El evento '{event.name}' no tiene event_uuid disponible "
                "(¿se ha llamado con el detalle del evento, no con el listado?)"
            )

        resolved_category = self._events.resolve_category(event, category)

        category_uuid = self._sessions.resolve_category_uuid(
            event.event_uuid, resolved_category.name
        )
        sessions = self._sessions.list(event.event_uuid, category_uuid)
        session = self._sessions.find_by_type(sessions, session_type)
        entries = self._classifications.get(session.id)

        return RaceResult(
            event_id=event.id,
            event_name=event.name,
            circuit=event.circuit_name,
            category=resolved_category.name,
            round=round_number,
            session_type=session_type,
            session_id=session.id,
            classification=entries,
        )

    @staticmethod
    def _current_season() -> int:
        return date.today().year
