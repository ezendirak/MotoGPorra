"""Tests de los campos añadidos para el consumidor MotoGPorra.

Todas las formas usadas aquí proceden de respuestas REALES capturadas de la
API (temporada 2026), no de suposiciones.
"""

from __future__ import annotations

from datetime import datetime, timezone

from motogp_client.models import Circuit, Event, Rider, Session


def test_event_exposes_schedule_fields_from_real_shape() -> None:
    # Recorte real de GET /v1/events (GP de Tailandia 2026).
    data = {
        "id": "364a0bd9-0000-0000-0000-000000000000",
        "name": "PT GRAND PRIX OF THAILAND",
        "shortname": "THA",
        "country": "TH",
        "kind": "GP",
        "sequence": 1,
        "date_start": "2026-02-27T08:00:00+07:00",
        "date_end": "2026-03-01T18:00:00+07:00",
        "time_zone": "ASIA/BANGKOK",
        "has_results": True,
    }

    event = Event.model_validate(data)

    assert event.sequence == 1
    assert event.has_results is True
    assert event.date_start is not None
    assert event.date_start.year == 2026
    # La fecha del evento viene con el desplazamiento LOCAL del circuito.
    assert event.date_start.utcoffset() is not None
    assert event.date_start.utcoffset().total_seconds() == 7 * 3600


def test_event_normalizes_time_zone_to_iana() -> None:
    assert Event.model_validate(
        {"id": "a", "name": "x", "time_zone": "ASIA/BANGKOK"}
    ).iana_time_zone == "Asia/Bangkok"

    assert Event.model_validate(
        {"id": "a", "name": "x", "time_zone": "EUROPE/MADRID"}
    ).iana_time_zone == "Europe/Madrid"

    # El caso que rompe un capitalize() ingenuo: sin tratar el guion bajo
    # saldría "America/Sao_paulo", que no es un identificador IANA válido.
    assert Event.model_validate(
        {"id": "a", "name": "x", "time_zone": "AMERICA/SAO_PAULO"}
    ).iana_time_zone == "America/Sao_Paulo"

    assert Event.model_validate({"id": "a", "name": "x"}).iana_time_zone is None


def test_session_date_is_utc_and_code_combines_type_and_number() -> None:
    # Recorte real de GET /v1/results/sessions (Tailandia 2026, MotoGP).
    data = {
        "id": "sess-1",
        "type": "FP",
        "number": 1,
        "date": "2026-02-27T10:45:00+00:00",
        "status": "FINISHED",
    }

    session = Session.model_validate(data)

    assert session.code == "FP1"
    assert session.date == datetime(2026, 2, 27, 10, 45, tzinfo=timezone.utc)


def test_session_code_omits_number_when_absent() -> None:
    assert Session.model_validate({"id": "s", "type": "RAC"}).code == "RAC"
    assert Session.model_validate({"id": "s", "type": "SPR"}).code == "SPR"
    # Q1 y Q2 comparten `type`: sin `number` no se distinguirían.
    assert Session.model_validate({"id": "s", "type": "Q", "number": 2}).code == "Q2"


def test_circuit_exposes_location_and_track_details() -> None:
    # Recorte real del objeto `circuit` embebido en el calendario.
    data = {
        "id": "3df492f2-b8e0-4c2b-b6e9-86a153127965",
        "name": "Chang International Circuit",
        "iso_code": "TH",
        "country": "Thailand",
        "city": "Tambon Isan",
        "lat": "14.9578931",
        "lng": "103.0848277",
        "track": {
            # La errata "lenght" es la real de la API.
            "lenght": "4554",
            "assets": {"info": {"path": "https://photos.motogp.com/tha-inf2o.svg"}},
        },
    }

    circuit = Circuit.model_validate(data)

    assert circuit.iso_code == "TH"
    assert circuit.country == "Thailand"
    assert circuit.length_meters == 4554
    assert circuit.layout_svg_url == "https://photos.motogp.com/tha-inf2o.svg"


def test_circuit_tolerates_missing_track_block() -> None:
    circuit = Circuit.model_validate({"id": "x", "name": "Sin datos"})

    assert circuit.length_meters is None
    assert circuit.layout_svg_url is None


def test_rider_is_active_filters_retired_and_inactive() -> None:
    activo = Rider.model_validate(
        {
            "id": "r1",
            "name": "Marc",
            "surname": "Marquez",
            "retired": False,
            "current_career_step": {"season": 2026, "current": True},
        }
    )
    retirado = Rider.model_validate(
        {
            "id": "r2",
            "name": "Otro",
            "surname": "Piloto",
            "retired": True,
            "current_career_step": {"season": 2026, "current": True},
        }
    )
    sin_paso_vigente = Rider.model_validate(
        {"id": "r3", "name": "Tercer", "surname": "Piloto", "retired": False}
    )

    assert activo.is_active is True
    assert retirado.is_active is False
    assert sin_paso_vigente.is_active is False
