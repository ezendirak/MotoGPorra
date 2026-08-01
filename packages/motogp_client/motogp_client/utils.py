"""Utilidades internas de la librería.

De momento contiene únicamente la lógica de "matching" de texto que
permite resolver nombres legibles (``"Germany"``, ``"Marc Marquez"``)
a los recursos exactos devueltos por la API, sin que el usuario de la
librería tenga que conocer IDs ni UUIDs.
"""

from __future__ import annotations

import difflib
import re
from typing import Callable, Sequence, TypeVar

T = TypeVar("T")

_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def looks_like_uuid(value: str) -> bool:
    """Comprueba si ``value`` tiene forma de UUID.

    Se usa para decidir si un identificador proporcionado por el usuario
    (p.ej. en ``get_event``) es ya un UUID/ID directo de la API o si hay
    que resolverlo por nombre.
    """
    return bool(_UUID_RE.match(value.strip()))


def normalize(text: str) -> str:
    """Normaliza texto para comparaciones insensibles a mayúsculas y espacios."""
    return " ".join(text.strip().casefold().split())


def find_best_match(
    items: Sequence[T],
    query: str,
    *,
    text_fn: Callable[[T], str],
    cutoff: float = 0.6,
) -> T | None:
    """Encuentra el elemento de ``items`` que mejor coincide con ``query``.

    Estrategia, en orden:
        1. Coincidencia exacta (normalizada) con el texto de búsqueda del ítem.
        2. Coincidencia por substring (``query`` contenido en el texto del ítem).
        3. Coincidencia difusa (``difflib``) para tolerar errores tipográficos.

    Args:
        items: Colección de candidatos (p.ej. una lista de ``Event``).
        query: Texto introducido por el usuario (p.ej. ``"Germany"``).
        text_fn: Función que extrae de cada ítem el texto contra el que
            comparar (p.ej. nombre + nombre corto + país).
        cutoff: Umbral de similitud (0-1) para la coincidencia difusa.

    Returns:
        El ítem que mejor coincide, o ``None`` si no se encuentra ninguno
        razonablemente similar.
    """
    norm_query = normalize(query)
    texts = [normalize(text_fn(item)) for item in items]

    for item, text in zip(items, texts):
        if norm_query == text:
            return item

    contains = [item for item, text in zip(items, texts) if norm_query in text]
    if contains:
        return contains[0]

    close = difflib.get_close_matches(norm_query, texts, n=1, cutoff=cutoff)
    if close:
        idx = texts.index(close[0])
        return items[idx]

    return None
