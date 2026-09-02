"""Descarga y transformación de las imágenes de piloto.

Todo lo que sabe de píxeles vive aquí; `jobs.py` solo orquesta. Las funciones
son puras salvo :func:`descargar`, así que se pueden probar con un PNG
fabricado en memoria y sin red.

Por qué hay que transformar y no enlazar:

- El recorte de estudio de MotoGP es un PNG de 1920x2883 y ~3,8 MB, y
  photos.motogp.com **ignora** cualquier parámetro de redimensionado. Medido:
  `?width=200`, `?w=200`, `?tr=w-200` y `?format=webp` devuelven byte por byte
  el original.
- Reescalado a 480px de ancho y convertido a WebP, ese mismo recorte pesa unos
  35 KB. El avatar cuadrado, unos 6 KB. La parrilla entera cabe en 1 MB.
"""

from __future__ import annotations

import hashlib
import io
import logging

import requests
from PIL import Image

logger = logging.getLogger(__name__)

ANCHO_CUERPO = 480
"""Ancho del recorte de cuerpo entero. Suficiente para una ficha a pantalla
completa en un móvil con densidad 3x sin pasar de ~35 KB."""

LADO_AVATAR = 256

PROPORCION_CABEZA = 0.72
"""Lado del recorte de cabeza, como fracción del ANCHO del cuerpo del piloto.

Las fotos de estudio están encuadradas de forma sorprendentemente uniforme: en
los 22 titulares de 2026 el cuerpo ocupa siempre la misma franja (x entre 533 y
1387 de 1920) y la cabeza empieza pegada al borde superior. Un cuadrado de
0,72 x el ancho del cuerpo, anclado arriba y centrado en el eje del cuerpo, da
cabeza y hombros con el mono del equipo visible en los 22. Verificado a ojo,
uno por uno: con 0,55 se cortaba la barbilla y con 0,85 la cara quedaba
diminuta.
"""


class ImagenNoDescargable(RuntimeError):
    """La imagen de origen no se ha podido bajar o no es una imagen."""


def hash_origen(url: str) -> str:
    """Identificador corto y estable de una URL de origen.

    Va en el nombre del fichero subido (`perfil-1a2b3c4d.webp`), y es lo que
    permite saber si hay que volver a descargar sin guardar una columna extra
    con la URL de MotoGP: si el hash que ya está en la base coincide con el de
    la URL que la API devuelve hoy, la imagen es la misma y no se toca.
    """
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]


def descargar(url: str, *, timeout: int = 60) -> bytes:
    """Baja una imagen de photos.motogp.com.

    Sin `Accept: application/json`: aquí no viaja JSON, y algún CDN se pone
    quisquilloso con las cabeceras heredadas de una sesión de API.
    """
    try:
        response = requests.get(
            url,
            headers={"User-Agent": "motogporra-sync/0.1", "Accept": "image/*"},
            timeout=timeout,
        )
    except requests.RequestException as exc:
        raise ImagenNoDescargable(f"No se pudo descargar {url}: {exc}") from exc

    if not response.ok:
        raise ImagenNoDescargable(f"{url} respondió {response.status_code}")
    return response.content


def _abrir(datos: bytes) -> Image.Image:
    try:
        return Image.open(io.BytesIO(datos)).convert("RGBA")
    except Exception as exc:  # noqa: BLE001 - Pillow lanza de todo
        raise ImagenNoDescargable(f"No es una imagen legible: {exc}") from exc


def _a_webp(imagen: Image.Image, *, calidad: int = 82, sin_perdida: bool = False) -> bytes:
    buffer = io.BytesIO()
    imagen.save(
        buffer,
        format="WEBP",
        quality=calidad,
        lossless=sin_perdida,
        # `method=6` es el compresor más lento y el que menos pesa. Da igual
        # tardar: son 22 imágenes una vez al año.
        method=6,
    )
    return buffer.getvalue()


def cuerpo_entero(datos: bytes) -> bytes:
    """Recorte de estudio reescalado a :data:`ANCHO_CUERPO`, en WebP."""
    imagen = _abrir(datos)
    alto = max(1, round(imagen.height * ANCHO_CUERPO / imagen.width))
    return _a_webp(imagen.resize((ANCHO_CUERPO, alto), Image.LANCZOS), calidad=80)


def cabeza(datos: bytes) -> bytes:
    """Avatar cuadrado de cabeza y hombros, recortado del cuerpo entero.

    El recorte se calcula desde la caja del contenido NO transparente, no desde
    el lienzo: la foto viene con márgenes vacíos a los lados y anclarse al
    lienzo dejaría la cara descentrada.
    """
    imagen = _abrir(datos)

    # `getbbox()` devuelve el rectángulo con píxeles no nulos. En un recorte con
    # fondo transparente es exactamente la silueta del piloto.
    caja = imagen.getbbox() or (0, 0, imagen.width, imagen.height)
    izq, arriba, der, _abajo = caja
    ancho_cuerpo = der - izq

    lado = max(1, int(ancho_cuerpo * PROPORCION_CABEZA))
    centro_x = izq + ancho_cuerpo // 2
    recorte = imagen.crop(
        (
            max(0, centro_x - lado // 2),
            arriba,
            min(imagen.width, centro_x + lado // 2),
            min(imagen.height, arriba + lado),
        )
    )
    return _a_webp(recorte.resize((LADO_AVATAR, LADO_AVATAR), Image.LANCZOS))


def dorsal(datos: bytes) -> bytes:
    """Dorsal del piloto, tal cual viene (192x119), convertido a WebP.

    Sin pérdida: es un gráfico plano con contornos duros y filos limpios, donde
    el WebP con pérdida deja halos alrededor del número. Aun así pesa menos que
    el PNG original.
    """
    return _a_webp(_abrir(datos), sin_perdida=True)
