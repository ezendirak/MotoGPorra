"""Acceso a Supabase mediante PostgREST.

Se usa HTTP en lugar de una conexión directa a Postgres (`psycopg`) por una
razón práctica: Supabase solo publica un registro AAAA para el host directo
(`db.<ref>.supabase.co`) y la red desde la que se ejecuta esto no tiene ruta
IPv6. PostgREST viaja por HTTPS y funciona desde cualquier sitio.

Coste de la decisión: cada llamada es su propia transacción, así que un job no
puede ser atómico de extremo a extremo. Se compensa haciendo TODOS los jobs
idempotentes — upserts por identificador de MotoGP y reemplazos completos —,
de modo que una ejecución interrumpida se arregla volviendo a ejecutarla.

La clave `service_role` bypassa RLS: este módulo no debe usarse jamás en un
contexto donde intervengan usuarios finales.
"""

from __future__ import annotations

import logging
from typing import Any, Iterable, Sequence

import requests

from .config import SyncConfig

logger = logging.getLogger(__name__)


class SupabaseError(RuntimeError):
    """Error devuelto por PostgREST."""


class SupabaseClient:
    """Cliente mínimo de PostgREST con lo que necesita el sincronizador."""

    def __init__(self, config: SyncConfig) -> None:
        self._config = config
        self._session = requests.Session()
        self._session.headers.update(
            {
                "apikey": config.service_role_key,
                "Authorization": f"Bearer {config.service_role_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    def close(self) -> None:
        self._session.close()

    def __enter__(self) -> "SupabaseClient":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    # -- primitivas ---------------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any = None,
        prefer: str | None = None,
    ) -> Any:
        headers = {"Prefer": prefer} if prefer else None
        url = f"{self._config.rest_url}/{path}"

        response = self._session.request(
            method,
            url,
            params=params,
            json=json,
            headers=headers,
            timeout=self._config.request_timeout,
        )

        if not response.ok:
            raise SupabaseError(
                f"{method} {path} -> {response.status_code}: {response.text[:500]}"
            )

        if not response.content:
            return None
        try:
            return response.json()
        except ValueError:
            return None

    def select(
        self,
        table: str,
        *,
        columns: str = "*",
        filters: dict[str, str] | None = None,
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"select": columns}
        params.update(filters or {})
        if order:
            params["order"] = order
        if limit:
            params["limit"] = limit
        return self._request("GET", table, params=params) or []

    def upsert(
        self,
        table: str,
        rows: Sequence[dict[str, Any]],
        *,
        on_conflict: str,
        returning: bool = True,
    ) -> list[dict[str, Any]]:
        """Inserta o actualiza por la clave indicada.

        `on_conflict` debe coincidir con una restricción UNIQUE real de la
        tabla; si no, PostgREST responde 409 en lugar de fusionar.
        """
        if not rows:
            return []

        prefer = "resolution=merge-duplicates"
        prefer += ",return=representation" if returning else ",return=minimal"

        result = self._request(
            "POST",
            table,
            params={"on_conflict": on_conflict},
            json=list(rows),
            prefer=prefer,
        )
        return result or []

    def insert(
        self, table: str, rows: Sequence[dict[str, Any]], *, returning: bool = True
    ) -> list[dict[str, Any]]:
        if not rows:
            return []
        prefer = "return=representation" if returning else "return=minimal"
        return self._request("POST", table, json=list(rows), prefer=prefer) or []

    def update(
        self, table: str, filters: dict[str, str], values: dict[str, Any]
    ) -> list[dict[str, Any]]:
        return (
            self._request(
                "PATCH",
                table,
                params=filters,
                json=values,
                prefer="return=representation",
            )
            or []
        )

    def delete(self, table: str, filters: dict[str, str]) -> None:
        # PostgREST exige siempre un filtro en DELETE; sin él respondería 400
        # en vez de borrar la tabla entera, pero más vale no depender de eso.
        if not filters:
            raise ValueError("delete() requiere al menos un filtro")
        self._request("DELETE", table, params=filters, prefer="return=minimal")

    def rpc(self, function: str, args: dict[str, Any]) -> Any:
        return self._request("POST", f"rpc/{function}", json=args)

    # -- utilidades de dominio ---------------------------------------------

    def get_active_season(self) -> dict[str, Any]:
        rows = self.select(
            "seasons", columns="id,year,name", filters={"is_active": "eq.true"}, limit=1
        )
        if not rows:
            raise SupabaseError(
                "No hay ninguna temporada activa. Revisa la migración de datos de referencia."
            )
        return rows[0]

    def get_category_id(self, code: str) -> str:
        rows = self.select(
            "categories", columns="id", filters={"code": f"eq.{code.upper()}"}, limit=1
        )
        if not rows:
            raise SupabaseError(f"No existe la categoría con código '{code}'.")
        return rows[0]["id"]

    def index_by(
        self, rows: Iterable[dict[str, Any]], key: str, value: str = "id"
    ) -> dict[Any, Any]:
        return {row[key]: row[value] for row in rows if row.get(key) is not None}
