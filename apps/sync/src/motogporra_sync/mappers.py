"""Traducción de los modelos de MotoGP al esquema de MotoGPorra.

ESTE ES EL ÚNICO SITIO que conoce las rarezas de la API de MotoGP. Si mañana
cambia un campo, el radio del cambio es este fichero: ni el esquema ni el
frontend se enteran.

Rarezas contempladas, todas verificadas contra respuestas reales:

- `sequence` es el número de ronda oficial, no la posición en la lista.
- `time_zone` llega en MAYÚSCULAS y hay que normalizarla a IANA.
- Las fechas del evento traen desplazamiento local; las de sesión son UTC.
- `type` no distingue FP1 de FP2: hay que componerlo con `number`.
- El podio identifica a los pilotos con un UUID de un espacio DISTINTO al de
  `GET /riders`; el bueno es `riders_api_uuid`.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from motogp_client.models import Circuit, Event, Rider, Session

logger = logging.getLogger(__name__)

# `type` de sesión -> `session_kind` del esquema.
_SESSION_KIND = {
    "FP": "fp",
    "PR": "practice",
    "Q": "qualifying",
    "SPR": "sprint",
    "WUP": "warmup",
    "RAC": "race",
}


def session_kind(session: Session) -> str:
    return _SESSION_KIND.get((session.type or "").strip().upper(), "other")


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def map_circuit(circuit: Circuit) -> dict[str, Any] | None:
    """Circuito. Devuelve None si no hay nada identificable que guardar."""
    if circuit is None or not circuit.id:
        return None

    def _coord(value: str | None) -> float | None:
        try:
            return float(value) if value else None
        except (TypeError, ValueError):
            return None

    track = circuit.track
    return {
        "motogp_circuit_id": circuit.id,
        "name": circuit.name or "Circuito sin nombre",
        "country_code": (circuit.iso_code or None),
        "country_name": circuit.country,
        "city": circuit.city,
        "latitude": _coord(circuit.lat),
        "longitude": _coord(circuit.lng),
        "length_meters": circuit.length_meters,
        "left_corners": _int_or_none(track.get("left_corners")),
        "right_corners": _int_or_none(track.get("right_corners")),
        "layout_svg_url": circuit.layout_svg_url,
    }


def _int_or_none(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def map_event(event: Event, *, season_id: str, circuit_id: str | None) -> dict[str, Any]:
    return {
        "season_id": season_id,
        "circuit_id": circuit_id,
        "motogp_event_id": event.id,
        "motogp_event_uuid": event.raw.get("results-api-event-uuid"),
        "name": event.name,
        "short_name": event.short_name,
        # `sequence` y no la posición en la lista: si un GP se cancela a mitad
        # de temporada, la posición dejaría de coincidir con la ronda oficial.
        "round": event.sequence,
        "country_code": event.country,
        "starts_at": _iso(event.date_start),
        "ends_at": _iso(event.date_end),
        "time_zone": event.iana_time_zone,
        "has_results": bool(event.has_results),
    }


def map_session(
    session: Session, *, event_id: str, category_id: str
) -> dict[str, Any]:
    return {
        "event_id": event_id,
        "category_id": category_id,
        "motogp_session_id": session.id,
        "type_code": (session.type or "").strip().upper(),
        "number": session.number,
        "code": session.code,
        "kind": session_kind(session),
        # Ya viene en UTC: no hay conversión que pueda salir mal.
        "scheduled_at": _iso(session.date),
        # Solo la carrera del domingo es apostable: el sprint se retiró de la
        # porra (decisión 2, revisada). La sesión SPR se sigue guardando —es
        # parte del fin de semana— pero no genera carrera ni apuesta.
        "is_bettable": session.code == "RAC",
    }


def map_race(
    session: Session,
    *,
    season_id: str,
    event_id: str,
    category_id: str,
    session_id: str,
    betting_closes_at: datetime | None,
) -> dict[str, Any]:
    return {
        "season_id": season_id,
        "event_id": event_id,
        "category_id": category_id,
        "session_id": session_id,
        # `kind` se conserva en el esquema por si algún día vuelve el sprint,
        # pero hoy solo se crean carreras.
        "kind": "race",
        "scheduled_at": _iso(session.date),
        "betting_closes_at": _iso(betting_closes_at),
    }


def betting_close_time(
    sessions: list[Session], *, margin_minutes: int
) -> datetime | None:
    """Momento de cierre: la Q1 del fin de semana, menos el margen.

    Se apuesta habiendo visto los entrenamientos pero no la parrilla, que es
    donde está la información que de verdad decide un podio.

    Buscar un código exacto tiene un riesgo que `min(date)` no tenía: si
    MotoGP renombra la sesión o cambia el formato del fin de semana, aquí no
    habría Q1 y el cálculo se quedaría sin ancla. Por eso el respaldo NO es
    devolver `None` (dejaría la carrera sin apuestas posibles) ni dejarlo
    abierto, sino **la primera sesión del fin de semana**: cierra antes de lo
    previsto, nunca después. Equivocarse cerrando pronto es un incordio;
    equivocarse cerrando tarde deja apostar con la parrilla ya vista, y eso
    rompe la porra.
    """
    q1 = next((s for s in sessions if s.code == "Q1" and s.date is not None), None)
    if q1 is not None and q1.date is not None:
        return q1.date - timedelta(minutes=margin_minutes)

    fechas = [s.date for s in sessions if s.date is not None]
    if not fechas:
        return None

    logger.warning(
        "Fin de semana sin Q1 (%s): el cierre cae en la primera sesión, %s",
        ", ".join(sorted(s.code for s in sessions)) or "sin sesiones",
        min(fechas).isoformat(),
    )
    return min(fechas) - timedelta(minutes=margin_minutes)


def map_constructor(constructor: Any) -> dict[str, Any] | None:
    if constructor is None or not constructor.name:
        return None
    return {
        "motogp_constructor_id": constructor.id,
        "motogp_legacy_id": getattr(constructor, "legacy_id", None),
        "name": constructor.name,
    }


def map_team(team: Any, *, constructor_id: str | None) -> dict[str, Any] | None:
    if team is None or not team.id or not team.name:
        return None
    return {
        "motogp_team_id": team.id,
        "motogp_legacy_id": team.legacy_id,
        "constructor_id": constructor_id,
        "name": team.name,
        "color": team.color,
        "text_color": team.text_color,
        "picture_url": team.picture,
    }


def map_rider(rider: Rider) -> dict[str, Any]:
    return {
        "motogp_rider_id": rider.id,
        "motogp_legacy_id": rider.legacy_id,
        "first_name": rider.name,
        "last_name": rider.surname,
        # No es columna generada en la base: `name` y `surname` son opcionales
        # y `a || NULL` daría NULL. La librería ya compone de forma tolerante.
        "full_name": rider.full_name or rider.nickname or "Piloto sin nombre",
        "nickname": rider.nickname,
        "country_code": rider.country.iso if rider.country else None,
        "country_name": rider.country.name if rider.country else None,
        "birth_date": rider.birth_date.isoformat() if rider.birth_date else None,
        "birth_city": rider.birth_city,
        "start_year": rider.start_year,
        "is_retired": bool(rider.retired),
    }


class RiderNotResolved(RuntimeError):
    """No se ha podido casar un piloto del resultado con la tabla `riders`."""


def resolve_rider_id(
    entry: Any,
    *,
    by_motogp_id: dict[str, str],
    by_legacy_id: dict[int, str],
) -> str:
    """Resuelve el piloto de una línea de clasificación a su UUID interno.

    ES EL PUNTO MÁS FRÁGIL DE TODO EL SISTEMA. Los UUID de piloto del endpoint
    de resultados pertenecen a un espacio DISTINTO al de ``GET /riders``.
    Verificado con el podio del GP de Alemania 2026:

        /riders          rider.id            = 23e50438-...
        clasificación    rider.id            = f55b433d-...   <- NO sirve
        clasificación    rider.riders_api_uuid = 23e50438-... <- este sí
        ambos            legacy_id           = 7444           <- respaldo

    Casar por ``rider.id`` no encontraría a nadie y todas las puntuaciones
    saldrían a cero **en silencio**. De ahí que el fallo sea ruidoso: es
    preferible abortar la importación de esa carrera a que la clasificación
    mienta.
    """
    piloto = entry.rider
    if piloto is None:
        raise RiderNotResolved("La línea de clasificación no trae piloto")

    if piloto.riders_api_uuid:
        uuid = by_motogp_id.get(piloto.riders_api_uuid)
        if uuid:
            return uuid

    if piloto.legacy_id is not None:
        uuid = by_legacy_id.get(piloto.legacy_id)
        if uuid:
            return uuid

    raise RiderNotResolved(
        f"Piloto sin resolver: {piloto.full_name!r} "
        f"(riders_api_uuid={piloto.riders_api_uuid}, legacy_id={piloto.legacy_id}). "
        "Ejecuta el job 'riders' antes que el de resultados."
    )


def map_result_entry(
    entry: Any, *, race_result_id: str, rider_id: str, constructor_id: str | None
) -> dict[str, Any]:
    """Una línea de la clasificación oficial.

    La API solo distingue 'INSTND' (clasificado) y 'OUTSTND' (no clasificado):
    no diferencia DNF de DNS ni de descalificación. Se guarda el booleano real
    y el código crudo en vez de inventar estados que nunca podríamos rellenar.

    Los tiempos se conservan como TEXTO tal y como llegan ('40:53.148'): nunca
    ordenamos por tiempo —ordenamos por posición—, así que convertirlos a
    milisegundos solo añadiría errores de parseo sin ningún beneficio.
    """
    estado = (entry.status or "").strip().upper()
    return {
        "race_result_id": race_result_id,
        "rider_id": rider_id,
        "position": entry.position,
        "is_classified": estado == "INSTND" and entry.position is not None,
        "status_raw": entry.status,
        "total_time": entry.time,
        "gap_to_first": entry.gap.first if entry.gap else None,
        "gap_laps": entry.gap.lap if entry.gap else None,
        "championship_points": entry.points,
        "team_name": entry.team_name,
        "constructor_id": constructor_id,
        "number": entry.rider.number if entry.rider else None,
    }


def map_rider_season_entry(
    rider: Rider,
    *,
    season_id: str,
    category_id: str,
    rider_id: str,
    team_id: str | None,
) -> dict[str, Any]:
    step = rider.current_career_step
    return {
        "season_id": season_id,
        "category_id": category_id,
        "rider_id": rider_id,
        "team_id": team_id,
        "sponsored_team": step.sponsored_team if step else None,
        "number": rider.number,
        "is_active": rider.is_active,
    }
