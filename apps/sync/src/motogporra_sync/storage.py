"""Acceso a Supabase Storage.

Vive aparte de `db.py` porque Storage no es PostgREST: tiene su propia API
(`/storage/v1`), su propio modelo de errores y no entiende de filtros ni de
`Prefer`. Comparte con él la clave `service_role`, y por tanto la misma
advertencia: bypasa RLS y no debe usarse jamás en un contexto de usuario final.

Solo implementa lo que necesita el job de imágenes: subir, listar y borrar.
"""

from __future__ import annotations

import logging
from typing import Any

import requests

from .config import SyncConfig

logger = logging.getLogger(__name__)


class StorageError(RuntimeError):
    """Error devuelto por la API de Storage."""


class SupabaseStorage:
    """Cliente mínimo de Supabase Storage."""

    def __init__(self, config: SyncConfig) -> None:
        self._config = config
        self._session = requests.Session()
        self._session.headers.update(
            {
                "apikey": config.service_role_key,
                "Authorization": f"Bearer {config.service_role_key}",
            }
        )

    def close(self) -> None:
        self._session.close()

    def __enter__(self) -> "SupabaseStorage":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    @property
    def _base(self) -> str:
        return f"{self._config.supabase_url.rstrip('/')}/storage/v1"

    def public_url(self, bucket: str, path: str) -> str:
        """URL pública y estable de un objeto de un bucket público.

        No caduca y no lleva firma: es la que se guarda en la base y la que
        cachean el navegador y el CDN.
        """
        return f"{self._base}/object/public/{bucket}/{path.lstrip('/')}"

    def upload(
        self, bucket: str, path: str, data: bytes, *, content_type: str
    ) -> str:
        """Sube (o reemplaza) un objeto y devuelve su URL pública.

        Usa `x-upsert` porque el job es idempotente: reejecutarlo debe
        sobrescribir sin fallar por «ya existe».
        """
        response = self._session.post(
            f"{self._base}/object/{bucket}/{path.lstrip('/')}",
            data=data,
            headers={
                "Content-Type": content_type,
                "x-upsert": "true",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
            timeout=self._config.request_timeout,
        )
        if not response.ok:
            raise StorageError(
                f"PUT {bucket}/{path} -> {response.status_code}: {response.text[:300]}"
            )
        return self.public_url(bucket, path)

    def list(self, bucket: str, prefix: str = "", *, limit: int = 1000) -> list[str]:
        """Nombres de los objetos que cuelgan de `prefix`, con el prefijo puesto.

        Storage devuelve el contenido de UNA carpeta, no un árbol: las
        subcarpetas aparecen como entradas sin `id`. Por eso se desciende
        recursivamente en vez de fiarse de una sola llamada.
        """
        response = self._session.post(
            f"{self._base}/object/list/{bucket}",
            json={
                "prefix": prefix,
                "limit": limit,
                "sortBy": {"column": "name", "order": "asc"},
            },
            timeout=self._config.request_timeout,
        )
        if not response.ok:
            raise StorageError(
                f"LIST {bucket}/{prefix} -> {response.status_code}: {response.text[:300]}"
            )

        entradas: list[dict[str, Any]] = response.json() or []
        rutas: list[str] = []
        for entrada in entradas:
            nombre = entrada.get("name")
            if not nombre:
                continue
            ruta = f"{prefix.rstrip('/')}/{nombre}" if prefix else nombre
            # Una carpeta no tiene `id`; un fichero sí.
            if entrada.get("id") is None:
                rutas.extend(self.list(bucket, ruta, limit=limit))
            else:
                rutas.append(ruta)
        return rutas

    def remove(self, bucket: str, paths: list[str]) -> None:
        if not paths:
            return
        response = self._session.delete(
            f"{self._base}/object/{bucket}",
            json={"prefixes": paths},
            headers={"Content-Type": "application/json"},
            timeout=self._config.request_timeout,
        )
        if not response.ok:
            raise StorageError(
                f"DELETE {bucket} -> {response.status_code}: {response.text[:300]}"
            )
