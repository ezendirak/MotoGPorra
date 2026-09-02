"""CLI del sincronizador.

    python -m motogporra_sync calendar
    python -m motogporra_sync riders
    python -m motogporra_sync images
    python -m motogporra_sync all
"""

from __future__ import annotations

import argparse
import json
import logging
import sys

from motogp_client import MotoGPClient

from .config import SyncConfig
from .db import SupabaseClient
from .jobs import sync_calendar, sync_images, sync_results, sync_riders

JOBS = {
    "calendar": sync_calendar,
    "riders": sync_riders,
    "results": sync_results,
    "images": sync_images,
    # Reimporta también las carreras que ya tienen resultado: es lo que hay
    # que ejecutar si MotoGP revisa una clasificación por sanción.
    "backfill": lambda c, d, cfg: sync_results(c, d, cfg, backfill=True),
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="motogporra_sync")
    parser.add_argument("job", choices=[*JOBS, "all"])
    parser.add_argument("--category", default="MotoGP")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)-7s %(message)s",
    )

    config = SyncConfig.from_env()
    if args.category != config.category:
        config = SyncConfig(
            supabase_url=config.supabase_url,
            service_role_key=config.service_role_key,
            category=args.category,
        )

    # El orden importa: los pilotos van antes que cualquier cosa que los
    # referencie, para que un sustituto que debute ese mismo fin de semana no
    # rompa la reconciliación del resultado.
    # `images` va al final y después de `riders`: necesita las inscripciones de
    # la temporada ya escritas para saber quién está activo. Es un no-op cuando
    # no hay imágenes nuevas, así que no encarece la ejecución periódica.
    nombres = (
        ["riders", "calendar", "results", "images"] if args.job == "all" else [args.job]
    )

    with MotoGPClient() as client, SupabaseClient(config) as db:
        for nombre in nombres:
            logging.info("--- job: %s ---", nombre)
            try:
                stats = JOBS[nombre](client, db, config)
            except Exception as exc:  # noqa: BLE001 - la CLI reporta y sale
                logging.error("El job '%s' ha fallado: %s", nombre, exc)
                return 1
            logging.info("%s -> %s", nombre, json.dumps(stats, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    sys.exit(main())
