"""Trabajos de sincronización.

Todos son IDEMPOTENTES: se pueden reejecutar sin duplicar nada. Es la
propiedad que sustituye a la atomicidad transaccional que no tenemos al ir por
PostgREST (ver db.py) — una ejecución interrumpida se arregla repitiéndola.

Toda reconciliación se hace por identificador de MotoGP, nunca por nombre: los
Grandes Premios cambian de patrocinador y hay dos pilotos apellidados Márquez.
"""

from __future__ import annotations

import logging
from typing import Any

from motogp_client import MotoGPClient
from motogp_client.exceptions import MotoGPError, NotFoundError

from . import mappers
from .config import SyncConfig
from .db import SupabaseClient

logger = logging.getLogger(__name__)


def _start_run(db: SupabaseClient, job: str, season_id: str) -> str:
    rows = db.insert(
        "sync_runs", [{"job": job, "state": "running", "season_id": season_id}]
    )
    return rows[0]["id"]


def _finish_run(
    db: SupabaseClient,
    run_id: str,
    *,
    state: str,
    stats: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    db.update(
        "sync_runs",
        {"id": f"eq.{run_id}"},
        {
            "state": state,
            "stats": stats or {},
            "error": error,
            "finished_at": "now()",
        },
    )


def sync_riders(
    client: MotoGPClient, db: SupabaseClient, config: SyncConfig
) -> dict[str, Any]:
    """Importa constructores, equipos, pilotos e inscripciones de la temporada.

    Una sola llamada a MotoGP (`GET /riders`). Barato: se puede ejecutar como
    paso previo del job de resultados para cubrir a un sustituto que debute
    ese mismo fin de semana.
    """
    season = db.get_active_season()
    category_id = db.get_category_id(config.category)
    run_id = _start_run(db, "riders", season["id"])

    try:
        riders = client.get_riders(category=config.category)
        logger.info("MotoGP devolvió %d pilotos", len(riders))

        # 1. Constructores (deduplicados por id de MotoGP).
        constructores: dict[str, dict[str, Any]] = {}
        for r in riders:
            step = r.current_career_step
            team = step.team if step else None
            fila = mappers.map_constructor(team.constructor if team else None)
            if fila and fila["motogp_constructor_id"]:
                constructores[fila["motogp_constructor_id"]] = fila

        filas_constructores = db.upsert(
            "constructors",
            list(constructores.values()),
            on_conflict="motogp_constructor_id",
        )
        id_constructor = db.index_by(filas_constructores, "motogp_constructor_id")

        # 2. Equipos.
        equipos: dict[str, dict[str, Any]] = {}
        for r in riders:
            step = r.current_career_step
            team = step.team if step else None
            if team is None:
                continue
            constructor_uuid = (
                id_constructor.get(team.constructor.id)
                if team.constructor and team.constructor.id
                else None
            )
            fila = mappers.map_team(team, constructor_id=constructor_uuid)
            if fila:
                equipos[fila["motogp_team_id"]] = fila

        filas_equipos = db.upsert(
            "teams", list(equipos.values()), on_conflict="motogp_team_id"
        )
        id_equipo = db.index_by(filas_equipos, "motogp_team_id")

        # 3. Pilotos.
        filas_pilotos = db.upsert(
            "riders",
            [mappers.map_rider(r) for r in riders],
            on_conflict="motogp_rider_id",
        )
        id_piloto = db.index_by(filas_pilotos, "motogp_rider_id")

        # 4. Inscripciones de la temporada: aquí es donde vive el histórico.
        inscripciones = []
        for r in riders:
            uuid_piloto = id_piloto.get(r.id)
            if not uuid_piloto:
                continue
            step = r.current_career_step
            team = step.team if step else None
            inscripciones.append(
                mappers.map_rider_season_entry(
                    r,
                    season_id=season["id"],
                    category_id=category_id,
                    rider_id=uuid_piloto,
                    team_id=id_equipo.get(team.id) if team else None,
                )
            )

        db.upsert(
            "rider_season_entries",
            inscripciones,
            on_conflict="season_id,category_id,rider_id",
            returning=False,
        )

        activos = sum(1 for r in riders if r.is_active)
        stats = {
            "constructores": len(constructores),
            "equipos": len(equipos),
            "pilotos": len(filas_pilotos),
            "inscripciones": len(inscripciones),
            "activos": activos,
        }
        _finish_run(db, run_id, state="success", stats=stats)
        return stats

    except Exception as exc:
        _finish_run(db, run_id, state="failed", error=f"{type(exc).__name__}: {exc}")
        raise


def sync_calendar(
    client: MotoGPClient, db: SupabaseClient, config: SyncConfig
) -> dict[str, Any]:
    """Importa circuitos, Grandes Premios, sesiones y carreras apostables.

    Es el job más caro: por cada GP hacen falta 3 llamadas para obtener sus
    sesiones. Por eso se programa semanalmente y no a diario — el calendario
    apenas cambia y el cierre de apuestas es el viernes.
    """
    season = db.get_active_season()
    category_id = db.get_category_id(config.category)
    run_id = _start_run(db, "calendar", season["id"])

    try:
        eventos = client.get_calendar_current()
        logger.info("Calendario: %d Grandes Premios", len(eventos))

        # 1. Circuitos.
        circuitos: dict[str, dict[str, Any]] = {}
        for e in eventos:
            fila = mappers.map_circuit(e.circuit) if e.circuit else None
            if fila:
                circuitos[fila["motogp_circuit_id"]] = fila

        filas_circuitos = db.upsert(
            "circuits", list(circuitos.values()), on_conflict="motogp_circuit_id"
        )
        id_circuito = db.index_by(filas_circuitos, "motogp_circuit_id")

        # 2. Eventos.
        filas_eventos = db.upsert(
            "events",
            [
                mappers.map_event(
                    e,
                    season_id=season["id"],
                    circuit_id=(
                        id_circuito.get(e.circuit.id) if e.circuit and e.circuit.id else None
                    ),
                )
                for e in eventos
            ],
            on_conflict="season_id,motogp_event_id",
        )
        id_evento = db.index_by(filas_eventos, "motogp_event_id")

        # 3. Sesiones y carreras, GP a GP.
        total_sesiones = 0
        total_carreras = 0
        sin_sesiones: list[str] = []

        for e in eventos:
            uuid_evento = id_evento.get(e.id)
            if not uuid_evento:
                continue

            try:
                sesiones = client.get_event_sessions(e.id, config.category)
            except (NotFoundError, MotoGPError) as exc:
                # Un GP futuro puede no tener aún horarios publicados. No es un
                # error: se registra y se reintentará en la próxima ejecución.
                logger.warning("Sin sesiones para %s: %s", e.short_name or e.name, exc)
                sin_sesiones.append(e.short_name or e.name)
                continue

            filas_sesiones = db.upsert(
                "sessions",
                [
                    mappers.map_session(s, event_id=uuid_evento, category_id=category_id)
                    for s in sesiones
                ],
                on_conflict="motogp_session_id",
            )
            id_sesion = db.index_by(filas_sesiones, "motogp_session_id")
            total_sesiones += len(filas_sesiones)

            cierre = mappers.betting_close_time(
                sesiones, margin_minutes=config.betting_close_margin_minutes
            )

            # Sprint y carrera comparten cierre: si el sprint cerrara el sábado,
            # se apostaría con la información de la clasificación ya conocida.
            carreras = [
                mappers.map_race(
                    s,
                    season_id=season["id"],
                    event_id=uuid_evento,
                    category_id=category_id,
                    session_id=id_sesion[s.id],
                    betting_closes_at=cierre,
                )
                for s in sesiones
                if s.code in ("SPR", "RAC") and s.id in id_sesion
            ]

            if carreras:
                db.upsert(
                    "races",
                    carreras,
                    on_conflict="event_id,category_id,kind",
                    returning=False,
                )
                total_carreras += len(carreras)

        stats = {
            "circuitos": len(circuitos),
            "eventos": len(filas_eventos),
            "sesiones": total_sesiones,
            "carreras": total_carreras,
            "sin_horarios": sin_sesiones,
        }
        _finish_run(
            db,
            run_id,
            state="partial" if sin_sesiones else "success",
            stats=stats,
        )
        return stats

    except Exception as exc:
        _finish_run(db, run_id, state="failed", error=f"{type(exc).__name__}: {exc}")
        raise
