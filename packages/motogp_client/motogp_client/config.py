"""Configuración centralizada del cliente MotoGP.

Toda opción configurable del cliente (URL base, timeouts, reintentos,
caché, etc.) vive en este módulo. El resto de la librería nunca debe
tener valores "mágicos" hardcodeados: deben venir de aquí.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class MotoGPConfig(BaseModel):
    """Configuración inmutable para :class:`motogp_client.client.MotoGPClient`.

    Attributes:
        base_url: URL base de la API interna de MotoGP (sin barra final).
        timeout: Timeout en segundos para cada petición HTTP.
        max_retries: Número máximo de reintentos ante errores 5xx o de red
            transitorios. ``0`` desactiva los reintentos.
        backoff_factor: Factor de backoff exponencial entre reintentos.
        user_agent: Cabecera ``User-Agent`` enviada en cada petición.
        enable_cache: Activa la caché opcional en memoria (se implementará
            en un paso posterior; el flag ya se expone aquí para que la
            interfaz pública no tenga que cambiar más adelante).
        cache_ttl: Tiempo de vida (segundos) de las entradas de caché.
    """

    model_config = {"frozen": True}

    base_url: str = "https://api.pulselive.motogp.com/motogp"
    timeout: float = Field(default=10.0, gt=0)
    max_retries: int = Field(default=3, ge=0)
    backoff_factor: float = Field(default=0.5, ge=0)
    user_agent: str = "motogp-client/0.1"
    enable_cache: bool = False
    cache_ttl: int = Field(default=300, ge=0)
