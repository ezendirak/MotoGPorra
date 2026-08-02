"""Configuración del sincronizador, leída del entorno."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    """Carga un fichero .env sin depender de python-dotenv.

    Las variables ya presentes en el entorno tienen prioridad: en GitHub
    Actions no hay .env y los valores llegan como secretos.
    """
    if not path.is_file():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


@dataclass(frozen=True)
class SyncConfig:
    """Parámetros de una ejecución del sincronizador."""

    supabase_url: str
    service_role_key: str

    category: str = "MotoGP"
    """Única categoría sincronizada de momento. El esquema soporta las cuatro."""

    betting_close_margin_minutes: int = 15
    """Minutos antes de la primera sesión (FP1) en que se cierran las apuestas."""

    request_timeout: int = 30

    triggered_by: str | None = None
    """UUID del administrador que lanzó esta ejecución desde el panel.

    `None` cuando la lanza el cron, que es lo que distingue una ejecución
    automática de una manual en `sync_runs`. Llega como entrada del
    `workflow_dispatch`; una cadena vacía se trata como ausencia, porque la FK
    contra `auth.users` rechazaría cualquier cosa que no sea un UUID válido.
    """

    @property
    def rest_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/rest/v1"

    @classmethod
    def from_env(cls, repo_root: Path | None = None) -> "SyncConfig":
        root = repo_root or Path(__file__).resolve().parents[4]
        _load_dotenv(root / ".env")
        _load_dotenv(root / "apps" / "web" / ".env.local")

        url = os.environ.get("SUPABASE_URL") or os.environ.get(
            "NEXT_PUBLIC_SUPABASE_URL", ""
        )
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

        missing = [
            name
            for name, value in (
                ("SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL", url),
                ("SUPABASE_SERVICE_ROLE_KEY", key),
            )
            if not value
        ]
        if missing:
            raise RuntimeError(
                "Faltan variables de entorno: " + ", ".join(missing)
            )

        return cls(
            supabase_url=url,
            service_role_key=key,
            triggered_by=os.environ.get("MOTOGPORRA_TRIGGERED_BY", "").strip() or None,
        )
