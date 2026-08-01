"""Excepciones propias de la librería.

Ningún componente público de ``motogp_client`` debe dejar escapar una
excepción de ``requests`` o de la librería estándar: todo se traduce a
alguna de las excepciones definidas aquí, todas ellas descendientes de
:class:`MotoGPError`.
"""

from __future__ import annotations


class MotoGPError(Exception):
    """Excepción base para cualquier error originado en la librería."""


class NetworkError(MotoGPError):
    """Error de red antes de obtener una respuesta HTTP (DNS, conexión...)."""


class MotoGPTimeoutError(MotoGPError):
    """La petición HTTP superó el timeout configurado."""


class ApiError(MotoGPError):
    """La API respondió con un código de error HTTP.

    Attributes:
        status_code: Código de estado HTTP devuelto por la API, si se conoce.
        response_body: Cuerpo crudo de la respuesta, útil para depuración.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        response_body: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class NotFoundError(ApiError):
    """El recurso solicitado no existe (HTTP 404)."""


class InvalidCategoryError(MotoGPError):
    """La categoría solicitada (p.ej. 'MotoGP', 'Moto2') no existe o no
    se ha podido resolver para el evento indicado."""


class InvalidSessionError(MotoGPError):
    """La sesión solicitada (p.ej. 'RAC', 'Q2') no existe o no se ha
    podido resolver para el evento/categoría indicados."""


class ConfigurationError(MotoGPError):
    """La configuración proporcionada al cliente es inválida."""
