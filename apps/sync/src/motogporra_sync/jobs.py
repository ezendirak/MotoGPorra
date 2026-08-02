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


def _import_race_result(
    client: MotoGPClient,
    db: SupabaseClient,
    carrera: dict[str, Any],
    *,
    by_motogp_id: dict[str, str],
    by_legacy_id: dict[int, str],
    by_constructor: dict[str, str],
) -> str:
    """Importa el resultado de UNA carrera y recalcula sus puntuaciones.

    Devuelve un código de resultado: 'importada', 'sin_disputar' o 'sin_sesion'.
    """
    session_uuid = carrera.get("sessions", {}).get("motogp_session_id")
    if not session_uuid:
        return "sin_sesion"

    # Una única petición: ya conocemos el UUID de sesión del job de calendario.
    entradas = client.get_session_classification(session_uuid)
    if not entradas:
        return "sin_disputar"

    cabecera = db.upsert(
        "race_results",
        [
            {
                "race_id": carrera["id"],
                "status": "official",
                "source": "motogp-client",
                "imported_at": "now()",
                "raw_payload": {
                    "session_id": session_uuid,
                    "entries": [e.model_dump(mode="json") for e in entradas],
                },
            }
        ],
        on_conflict="race_id",
    )
    race_result_id = cabecera[0]["id"]

    filas = []
    for e in entradas:
        rider_id = mappers.resolve_rider_id(
            e, by_motogp_id=by_motogp_id, by_legacy_id=by_legacy_id
        )
        constructor_id = (
            by_constructor.get(e.constructor.id)
            if e.constructor and e.constructor.id
            else None
        )
        filas.append(
            mappers.map_result_entry(
                e,
                race_result_id=race_result_id,
                rider_id=rider_id,
                constructor_id=constructor_id,
            )
        )

    # Reemplazo completo: idempotente y evita arrastrar posiciones antiguas si
    # MotoGP revisa el resultado por una sanción.
    db.delete("race_result_entries", {"race_result_id": f"eq.{race_result_id}"})
    db.insert("race_result_entries", filas, returning=False)

    # Se llama DESPUÉS de que las entradas estén completas, nunca por trigger:
    # un trigger se dispararía una vez por cada una de las ~22 líneas.
    db.rpc("recalculate_race_scores", {"p_race_id": carrera["id"]})

    return "importada"


def sync_results(
    client: MotoGPClient,
    db: SupabaseClient,
    config: SyncConfig,
    *,
    backfill: bool = False,
) -> dict[str, Any]:
    """Importa resultados oficiales y recalcula puntuaciones.

    Por defecto solo mira las carreras ya cerradas que aún no tienen resultado
    oficial. Con `backfill=True` reimporta también las que ya lo tienen, que es
    lo que hay que hacer si MotoGP revisa una clasificación por sanción.

    Coste: una petición por sesión, porque los UUID de sesión ya están en la
    base desde el job de calendario. Importar la temporada entera son ~44
    peticiones, no las ~176 que costaría resolver evento y sesión cada vez.
    """
    season = db.get_active_season()
    run_id = _start_run(db, "backfill" if backfill else "results", season["id"])

    try:
        # Índices de reconciliación. Se cargan una vez y se reutilizan.
        pilotos = db.select("riders", columns="id,motogp_rider_id,motogp_legacy_id")
        by_motogp_id = {
            r["motogp_rider_id"]: r["id"] for r in pilotos if r["motogp_rider_id"]
        }
        by_legacy_id = {
            r["motogp_legacy_id"]: r["id"] for r in pilotos if r["motogp_legacy_id"]
        }
        by_constructor = {
            c["motogp_constructor_id"]: c["id"]
            for c in db.select("constructors", columns="id,motogp_constructor_id")
            if c["motogp_constructor_id"]
        }

        # Carreras candidatas: las que ya han cerrado, con su UUID de sesión.
        vistas = db.select(
            "races_view",
            columns="id,status,kind,round,event_name",
            filters={"status": "in.(closed,finished)", "season_id": f"eq.{season['id']}"},
            order="scheduled_at",
        )
        candidatas = {v["id"]: v for v in vistas}

        carreras = db.select(
            "races",
            columns="id,sessions(motogp_session_id)",
            filters={"season_id": f"eq.{season['id']}"},
        )

        importadas = 0
        sin_disputar = 0
        sin_resolver: list[str] = []
        ya_estaban = 0

        con_resultado = {
            r["race_id"]
            for r in db.select("race_results", columns="race_id,status")
            if r["status"] == "official"
        }

        for carrera in carreras:
            vista = candidatas.get(carrera["id"])
            if vista is None:
                continue  # aún no ha cerrado
            if carrera["id"] in con_resultado and not backfill:
                ya_estaban += 1
                continue

            etiqueta = f"R{vista['round']} {vista['kind']}"
            try:
                estado = _import_race_result(
                    client,
                    db,
                    carrera,
                    by_motogp_id=by_motogp_id,
                    by_legacy_id=by_legacy_id,
                    by_constructor=by_constructor,
                )
            except mappers.RiderNotResolved as exc:
                # Un piloto sin resolver significa un podio potencialmente mal
                # puntuado. Se salta esa carrera y se deja constancia ruidosa.
                logger.error("%s: %s", etiqueta, exc)
                sin_resolver.append(etiqueta)
                continue

            if estado == "importada":
                importadas += 1
                logger.info("%s importada", etiqueta)
            elif estado == "sin_disputar":
                sin_disputar += 1

        stats = {
            "importadas": importadas,
            "ya_tenian_resultado": ya_estaban,
            "sin_disputar": sin_disputar,
            "pilotos_sin_resolver": sin_resolver,
        }
        _finish_run(
            db,
            run_id,
            state="partial" if sin_resolver else "success",
            stats=stats,
        )
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
