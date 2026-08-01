"""motogp_client: cliente Python para la API interna de MotoGP.com.

Uso básico:

    from motogp_client import MotoGPClient

    client = MotoGPClient()
    # En pasos futuros: client.get_calendar(2026), client.get_rider(...), etc.
"""

from .client import MotoGPClient
from .config import MotoGPConfig
from .exceptions import (
    ApiError,
    ConfigurationError,
    InvalidCategoryError,
    InvalidSessionError,
    MotoGPError,
    MotoGPTimeoutError,
    NetworkError,
    NotFoundError,
)
from .models import Category, ClassificationEntry, Event, RaceResult, Rider, Session, Team

__all__ = [
    "MotoGPClient",
    "MotoGPConfig",
    "MotoGPError",
    "ApiError",
    "NotFoundError",
    "InvalidCategoryError",
    "InvalidSessionError",
    "NetworkError",
    "MotoGPTimeoutError",
    "ConfigurationError",
    "Event",
    "Category",
    "Rider",
    "Team",
    "Session",
    "ClassificationEntry",
    "RaceResult",
]

__version__ = "0.1.0"
