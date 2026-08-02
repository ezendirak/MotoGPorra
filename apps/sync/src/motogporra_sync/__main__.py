"""CLI del sincronizador.

    python -m motogporra_sync calendar
    python -m motogporra_sync riders
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
from .jobs import sync_calendar, sync_riders

JOBS = {
    "calendar": sync_calendar,
    "riders": sync_riders,
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
    # referencie, para que un sustituto que debute no rompa la importación.
    nombres = ["riders", "calendar"] if args.job == "all" else [args.job]

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
