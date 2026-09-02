"""Tests del cálculo del cierre de apuestas.

Esta función decide cuándo deja de poderse apostar. Un fallo aquí no da error:
deja la porra abierta cuando ya no debería estarlo, y eso no lo detecta nadie
hasta que alguien apuesta con información que no debería tener.

Las sesiones reproducen un fin de semana real de MotoGP 2026 (Tailandia), con
las fechas ya en UTC, que es como las devuelve la API.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from motogp_client.models import Session

from motogporra_sync.mappers import betting_close_time

UTC = timezone.utc


def _sesion(code: str, cuando: datetime) -> Session:
    """Construye una sesión con el `code` pedido.

    `code` es una propiedad calculada de `type` + `number`, así que hay que
    fabricarla por sus partes: 'Q1' es type='Q' y number=1, y 'RAC' no lleva
    número.
    """
    tipo = code.rstrip("0123456789")
    numero = code[len(tipo) :]
    return Session(
        id=f"s-{code}",
        type=tipo,
        number=int(numero) if numero else None,
        date=cuando,
    )


def _fin_de_semana() -> list[Session]:
    viernes = datetime(2026, 2, 27, 10, 45, tzinfo=UTC)
    sabado = datetime(2026, 2, 28, 3, 40, tzinfo=UTC)
    domingo = datetime(2026, 3, 1, 7, 0, tzinfo=UTC)
    return [
        _sesion("FP1", viernes),
        _sesion("PR", viernes + timedelta(hours=4)),
        _sesion("FP2", sabado - timedelta(hours=1)),
        _sesion("Q1", sabado),
        _sesion("Q2", sabado + timedelta(minutes=25)),
        _sesion("WUP", domingo - timedelta(hours=3)),
        _sesion("RAC", domingo),
    ]


def test_cierra_cinco_minutos_antes_de_la_q1() -> None:
    cierre = betting_close_time(_fin_de_semana(), margin_minutes=5)

    assert cierre == datetime(2026, 2, 28, 3, 35, tzinfo=UTC)


def test_el_orden_de_la_lista_da_igual() -> None:
    """La API no promete orden, y el cálculo no debe depender de él."""
    sesiones = _fin_de_semana()
    cierre = betting_close_time(list(reversed(sesiones)), margin_minutes=5)

    assert cierre == betting_close_time(sesiones, margin_minutes=5)


def test_no_confunde_q1_con_q2() -> None:
    """`type` vale 'Q' para las dos: solo `number` las distingue."""
    cierre = betting_close_time(_fin_de_semana(), margin_minutes=5)
    q2 = datetime(2026, 2, 28, 4, 5, tzinfo=UTC)

    assert cierre is not None and cierre < q2


def test_sin_q1_cae_en_la_primera_sesion_y_nunca_despues() -> None:
    """El respaldo cierra ANTES de lo previsto, jamás después.

    Si MotoGP renombrara la Q1 o cambiara el formato, la alternativa segura es
    volver al comportamiento anterior (la primera sesión del fin de semana).
    Cerrar tarde permitiría apostar con la parrilla ya conocida.
    """
    sesiones = [s for s in _fin_de_semana() if s.code != "Q1"]

    cierre = betting_close_time(sesiones, margin_minutes=5)

    assert cierre == datetime(2026, 2, 27, 10, 40, tzinfo=UTC)


def test_una_q1_sin_fecha_no_cuenta_como_ancla() -> None:
    """Una sesión anunciada sin hora no sirve para cerrar nada."""
    sesiones = [s for s in _fin_de_semana() if s.code != "Q1"]
    sesiones.append(Session(id="s-Q1", type="Q", number=1, date=None))

    cierre = betting_close_time(sesiones, margin_minutes=5)

    assert cierre == datetime(2026, 2, 27, 10, 40, tzinfo=UTC)


def test_sin_sesiones_no_hay_cierre() -> None:
    """`None` acaba en `betting_closes_at` nulo, y la base lo lee como cerrado
    (`is_betting_open` devuelve false). Es el extremo seguro."""
    assert betting_close_time([], margin_minutes=5) is None


def test_todas_las_sesiones_sin_fecha_tampoco_dan_cierre() -> None:
    sesiones = [Session(id="s1", type="FP", number=1, date=None)]

    assert betting_close_time(sesiones, margin_minutes=5) is None


@pytest.mark.parametrize("margen", [0, 5, 15, 60])
def test_el_margen_se_resta_de_la_q1(margen: int) -> None:
    cierre = betting_close_time(_fin_de_semana(), margin_minutes=margen)

    assert cierre == datetime(2026, 2, 28, 3, 40, tzinfo=UTC) - timedelta(
        minutes=margen
    )
