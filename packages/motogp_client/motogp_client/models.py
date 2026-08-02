"""Modelos Pydantic de dominio.

Contiene:

- :class:`Category`, :class:`Event` — calendario y detalle de eventos.
- :class:`Rider` — pilotos (forma verificada contra documentación real,
  ver docstring de la clase).
- :class:`Constructor`, :class:`Team` — equipos (aún sin verificar contra
  una respuesta real; ver docstring de la clase).
- :class:`Session` — sesiones de un evento (FP1, Q2, RAC, SPR...).
- :class:`ClassificationEntry`, :class:`RaceResult` — resultados de una
  sesión, ya listos para el consumidor final de la librería (forma
  verificada contra documentación real, ver docstring de la clase).

Todos los modelos usan ``extra="allow"`` porque la API interna de
MotoGP no está documentada oficialmente y puede devolver campos
adicionales en cualquier momento; preferimos conservarlos (accesibles
vía ``.raw``) antes que perder información o que un campo nuevo rompa
el parseo.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Category(BaseModel):
    """Categoría de competición (MotoGP, Moto2, Moto3, MotoE...)."""

    model_config = ConfigDict(extra="allow")

    id: str
    name: str
    legacy_id: int | None = None


class ResultsApiRef(BaseModel):
    """Referencia a la API de resultados embebida en el detalle de un evento.

    Es el bloque que contiene el ``eventUuid`` necesario para consultar
    sesiones y clasificaciones; ver flujo interno documentado en
    ``endpoints/events.py``.
    """

    model_config = ConfigDict(extra="allow")

    event_uuid: str | None = Field(default=None, alias="eventUuid")


class Circuit(BaseModel):
    """Circuito donde se celebra un evento.

    Los campos de localización se verificaron contra una respuesta real de
    ``GET /v1/events`` (temporada 2026): el objeto ``circuit`` es bastante más
    rico de lo que sugería la primera versión de este modelo, e incluye país,
    ciudad y coordenadas, además de un bloque ``track`` con las medidas del
    trazado y sus imágenes.
    """

    model_config = ConfigDict(extra="allow")

    id: str | None = None
    name: str | None = None
    iso_code: str | None = None
    """Código ISO del país (p.ej. ``"TH"``)."""
    country: str | None = None
    """Nombre completo del país (p.ej. ``"Thailand"``)."""
    city: str | None = None
    lat: str | None = None
    lng: str | None = None

    @property
    def track(self) -> dict[str, Any]:
        """Bloque ``track``: longitud, curvas y recursos gráficos del trazado."""
        return self.raw.get("track") or {}

    @property
    def length_meters(self) -> int | None:
        """Longitud del trazado en metros.

        La API la devuelve como texto en ``track.lenght`` (con esa errata en
        el nombre del campo, que es la real).
        """
        value = self.track.get("lenght")
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    @property
    def layout_svg_url(self) -> str | None:
        """URL del SVG con el trazado del circuito."""
        assets = self.track.get("assets") or {}
        info = assets.get("info") or {}
        return info.get("path")

    @property
    def raw(self) -> dict[str, Any]:
        return self.model_extra or {}


class Event(BaseModel):
    """Un Gran Premio (evento) de una temporada.

    Puede representar tanto una entrada resumida del calendario
    (``GET /v1/events``) como el detalle completo de un evento
    (``GET /v1/events/{id}``).

    Forma verificada con llamadas REALES y en vivo a ambos endpoints
    (temporada 2026, GP de Alemania). Dos correcciones importantes
    respecto a la primera versión de este modelo, que asumía la
    descripción textual de tu documento en vez de una respuesta real:

    - No existe un campo booleano ``test``. Un evento de test se
      distingue por ``kind == "TEST"`` (frente a ``"GP"`` para un Gran
      Premio normal). Ver la propiedad :attr:`is_test`.
    - ``circuit`` es un objeto anidado (``{"id", "name", ...}``), no un
      texto plano. Ver la propiedad :attr:`circuit_name`.
    - El ``event_uuid`` viene realmente en un campo plano
      ``"results-api-event-uuid"`` (kebab-case), no anidado bajo
      ``results_api.eventUuid`` como decía tu documento. Se mantiene el
      soporte para ambas formas en :attr:`event_uuid`, por si la API
      cambia o difiere entre entornos.
    - El número de ronda sí aparece como campo real ``"sequence"``
      (confirmado en la respuesta real), lo cual valida la lógica de
      ``EventsEndpoint.get_by_round``.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str
    name: str
    short_name: str | None = Field(default=None, alias="shortname")
    additional_name: str | None = None
    country: str | None = None
    """Código ISO del país (p.ej. ``"DE"``), no el nombre completo."""
    circuit: Circuit | None = None
    status: str | None = None
    kind: str | None = None
    """``"GP"`` para un Gran Premio normal, ``"TEST"`` para un test oficial."""
    categories: list[Category] = Field(default_factory=list)
    results_api: ResultsApiRef | None = None

    # -- programación del fin de semana ------------------------------------
    # Verificados con una llamada real: el calendario SÍ devuelve estas
    # fechas, con desplazamiento horario LOCAL del circuito (p.ej.
    # ``2026-02-27T08:00:00+07:00`` para Tailandia).
    date_start: datetime | None = None
    """Inicio del Gran Premio. Es el arranque del fin de semana (jueves),
    NO la hora de la primera sesión: para calcular cuándo empieza FP1 hay
    que consultar las sesiones (:meth:`MotoGPClient.get_event_sessions`)."""
    date_end: datetime | None = None
    sequence: int | None = None
    """Número de ronda dentro de la temporada. Es un campo REAL de la API
    (confirmado: 1, 2, 3...), no una posición calculada en la lista."""
    time_zone: str | None = None
    """Zona horaria del circuito, en MAYÚSCULAS (p.ej. ``"ASIA/BANGKOK"``).
    Ver :attr:`iana_time_zone` para la forma normalizada."""
    has_results: bool | None = None

    @property
    def circuit_name(self) -> str | None:
        return self.circuit.name if self.circuit else None

    @property
    def iana_time_zone(self) -> str | None:
        """:attr:`time_zone` normalizada al formato IANA.

        La API la devuelve en mayúsculas (``"EUROPE/MADRID"``), que no es un
        identificador IANA válido; las bases de datos y ``zoneinfo`` esperan
        ``"Europe/Madrid"``.
        """
        if not self.time_zone:
            return None

        def _normalize(part: str) -> str:
            # Cada segmento puede llevar guion bajo ("SAO_PAULO"), y también
            # hay que capitalizar lo que va después: IANA usa "Sao_Paulo".
            return "_".join(word.capitalize() for word in part.split("_"))

        return "/".join(_normalize(part) for part in self.time_zone.split("/"))

    @property
    def is_test(self) -> bool:
        return (self.kind or "").strip().upper() == "TEST"

    @property
    def is_race(self) -> bool:
        """``True`` solo para un Gran Premio real (``kind == "GP"``).

        El calendario incluye otros ``kind`` sin resultados de carrera
        (``"TEST"``, y también ``"MEDIA"`` para eventos promocionales
        como presentaciones de equipo o el "World Ducati Week", que no
        tienen ``event_uuid`` de resultados). Solo ``"GP"`` es una
        carrera real; de ahí que :meth:`EventsEndpoint.list_races` use
        esta propiedad en vez de negar :attr:`is_test`.
        """
        return (self.kind or "").strip().upper() == "GP"

    @property
    def event_uuid(self) -> str | None:
        """UUID interno del evento, usado para consultar sesiones/resultados.

        Solo está disponible cuando el ``Event`` proviene del endpoint de
        detalle (``EventsEndpoint.get_detail``), no del listado de calendario.
        """
        if self.results_api and self.results_api.event_uuid:
            return self.results_api.event_uuid
        return self.raw.get("results-api-event-uuid")

    def get_category(self, name: str) -> Category | None:
        """Busca una categoría de este evento por nombre (case-insensitive)."""
        target = name.strip().casefold()
        for category in self.categories:
            if category.name.strip().casefold() == target:
                return category
        return None

    @property
    def raw(self) -> dict[str, Any]:
        """Campos adicionales devueltos por la API y no modelados explícitamente."""
        return self.model_extra or {}


class Constructor(BaseModel):
    """Fabricante de la moto (Ducati, Yamaha, KTM...)."""

    model_config = ConfigDict(extra="allow")

    id: str | None = None
    name: str | None = None


class CountryRef(BaseModel):
    """País de un piloto."""

    model_config = ConfigDict(extra="allow")

    iso: str | None = None
    name: str | None = None


class TeamRef(BaseModel):
    """Referencia a un equipo dentro del paso de carrera de un piloto.

    Los colores y la imagen vienen en la respuesta real y son útiles para
    pintar la ficha del piloto sin mantener una tabla de colores propia.
    """

    model_config = ConfigDict(extra="allow")

    id: str | None = None
    name: str | None = None
    legacy_id: int | None = None
    constructor: Constructor | None = None
    color: str | None = None
    text_color: str | None = None
    picture: str | None = None
    category: Category | None = None


class CareerStep(BaseModel):
    """Temporada/categoría/equipo actual de un piloto.

    Corresponde a ``current_career_step`` en la respuesta real de
    ``GET /riders`` (ver fuente en la docstring de :class:`Rider`).
    """

    model_config = ConfigDict(extra="allow")

    season: int | None = None
    number: int | None = None
    sponsored_team: str | None = None
    team: TeamRef | None = None
    category: Category | None = None
    current: bool | None = None


class Rider(BaseModel):
    """Piloto.

    Forma verificada contra documentación de terceros que describe esta
    misma API (`robschmitt/MotoGP-API` en GitHub, con ejemplos de
    respuesta real de ``GET /riders``). Puntos clave que NO coincidían
    con la primera versión de este modelo:

    - El nombre viene separado en ``name`` (nombre) y ``surname``
      (apellido), no en un único ``full_name``.
    - La categoría y el equipo actuales no son campos de primer nivel:
      están anidados bajo ``current_career_step``.

    Aun así, esta fuente describe una versión algo antigua de la API
    (usa rutas ``/v1/...`` sin el ``v2`` que sí aparece en tu
    documentación de ``classifications``), así que sigue siendo
    prudente validarlo con una respuesta real en cuanto se pueda.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str
    name: str | None = None
    surname: str | None = None
    nickname: str | None = None
    legacy_id: int | None = None
    country: CountryRef | None = None
    current_career_step: CareerStep | None = None

    # Campos confirmados en la respuesta real de GET /v1/riders.
    birth_date: date | None = None
    birth_city: str | None = None
    start_year: int | None = None
    retired: bool | None = None
    retired_year: int | None = None
    published: bool | None = None

    @property
    def full_name(self) -> str | None:
        """Nombre completo, combinando ``name`` y ``surname``."""
        parts = [self.name, self.surname]
        joined = " ".join(p for p in parts if p)
        return joined or None

    @property
    def category_name(self) -> str | None:
        step = self.current_career_step
        return step.category.name if step and step.category else None

    @property
    def team_name(self) -> str | None:
        step = self.current_career_step
        if step is None:
            return None
        return step.sponsored_team or (step.team.name if step.team else None)

    @property
    def number(self) -> int | None:
        return self.current_career_step.number if self.current_career_step else None

    @property
    def is_active(self) -> bool:
        """¿Compite esta temporada?

        ``GET /riders`` devuelve más pilotos que parrilla real (29 en MotoGP
        2026 frente a 22 titulares): incluye retirados y sustitutos. Un piloto
        cuenta como activo si no está retirado y su paso de carrera actual
        está marcado como vigente.
        """
        if self.retired:
            return False
        step = self.current_career_step
        return bool(step and step.current)

    @property
    def raw(self) -> dict[str, Any]:
        return self.model_extra or {}


class Team(BaseModel):
    """Equipo, con su constructor y categoría asociados.

    Igual que en :class:`Rider`, los nombres de campo son la mejor
    estimación pendiente de verificar contra una respuesta real.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str
    name: str | None = None
    constructor: Constructor | None = None
    category: Category | None = None

    @property
    def category_name(self) -> str | None:
        return self.category.name if self.category else None

    @property
    def raw(self) -> dict[str, Any]:
        return self.model_extra or {}


class Session(BaseModel):
    """Sesión de un evento (FP1, FP2, PR, Q1, Q2, SPR, WUP, RAC...).

    Forma verificada con una llamada real a ``GET /v1/results/sessions``
    (GP de Tailandia 2026, MotoGP): devuelve 8 sesiones con los campos
    ``id``, ``type``, ``number``, ``date``, ``status``, ``circuit``,
    ``condition`` y ``session_files``.

    Dos detalles importantes:

    - ``type`` NO distingue FP1 de FP2: ambas son ``"FP"`` y se diferencian
      por ``number`` (1 y 2). Lo mismo ocurre con ``"Q"`` para Q1 y Q2. Ver
      :attr:`code` para el identificador compuesto.
    - ``date`` llega **en UTC** (``2026-02-27T10:45:00+00:00``), a diferencia
      de las fechas del evento, que vienen con el desplazamiento local del
      circuito. No hace falta convertir nada.
    """

    model_config = ConfigDict(extra="allow")

    id: str
    type: str | None = None
    number: int | None = None
    date: datetime | None = None
    """Hora de inicio de la sesión, en UTC."""
    status: str | None = None

    @property
    def code(self) -> str:
        """Identificador legible de la sesión: ``FP1``, ``Q2``, ``SPR``, ``RAC``.

        Compone ``type`` y ``number`` porque la API no ofrece un código único
        por sesión.
        """
        base = (self.type or "").strip().upper()
        return f"{base}{self.number}" if self.number is not None else base

    @property
    def raw(self) -> dict[str, Any]:
        return self.model_extra or {}


class RiderResultRef(BaseModel):
    """Referencia a un piloto dentro de una entrada de clasificación."""

    model_config = ConfigDict(extra="allow")

    id: str | None = None
    full_name: str | None = None
    country: CountryRef | None = None
    legacy_id: int | None = None
    number: int | None = None
    riders_api_uuid: str | None = None
    """UUID que coincide con el ``id`` usado en ``GET /riders/{id}``."""


class Gap(BaseModel):
    """Diferencia respecto al líder (``first``, ``"0.000"`` para el propio
    líder) y vueltas de retraso si el piloto se retiró (``lap``).
    """

    model_config = ConfigDict(extra="allow")

    first: str | None = None
    lap: str | None = None


class ClassificationEntry(BaseModel):
    """Una línea de la clasificación de una sesión: posición, piloto,
    constructor, equipo, tiempo total, diferencia con el líder y puntos.

    Forma verificada con una llamada REAL y en vivo al endpoint exacto
    que proporcionaste (``GET /v2/results/classifications?session=...``,
    GP de Alemania 2026, categoría MotoGP, sesión RAC). No es una
    estimación: es la respuesta real de la API. Detalles que NO
    coincidían con la primera versión (basada en documentación de
    terceros de una versión distinta de la API):

    - ``team_name`` es un texto plano, no un objeto ``team`` anidado.
    - ``time`` es el tiempo total de carrera (no la vuelta rápida).
    - ``gap`` tiene ``first`` y ``lap`` (vueltas de retraso si se
      retiró), no ``first``/``prev``.
    - Si el piloto se retiró, ``position`` es ``null`` y ``status``
      vale ``"OUTSTND"`` (frente a ``"INSTND"`` para quien sí puntuó).
    - Sí existe un campo ``points`` por sesión (a diferencia de lo que
      sugería la documentación de terceros).
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str | None = None
    position: int | None = None
    rider: RiderResultRef | None = None
    constructor: Constructor | None = None
    team_name: str | None = None
    average_speed: float | None = None
    total_laps: int | None = None
    time: str | None = None
    points: float | None = None
    gap: Gap | None = None
    status: str | None = None

    @property
    def rider_name(self) -> str | None:
        return self.rider.full_name if self.rider else None

    @property
    def gap_to_leader(self) -> str | None:
        """Diferencia respecto al líder (``"0.000"`` para el propio líder)."""
        return self.gap.first if self.gap else None

    @property
    def raw(self) -> dict[str, Any]:
        return self.model_extra or {}


class RaceResult(BaseModel):
    """Resultado completo de una sesión de carrera (o sprint), listo para
    que la aplicación lo persista y lo muestre.

    Es el tipo de retorno de ``MotoGPClient.get_race_results`` y
    ``MotoGPClient.get_latest_race_results``. No expone ningún UUID
    interno: solo datos de negocio.
    """

    event_id: str
    event_name: str
    circuit: str | None = None
    category: str
    round: int | None = None
    session_type: str
    session_id: str | None = None
    """UUID de la sesión de la que salió esta clasificación. Permite auditar
    el origen del resultado sin repetir la cadena de llamadas."""
    classification: list[ClassificationEntry] = Field(default_factory=list)

    @property
    def podium(self) -> list[ClassificationEntry]:
        """Los 3 primeros clasificados, o menos si no hay suficientes."""
        return self.classification[:3]
