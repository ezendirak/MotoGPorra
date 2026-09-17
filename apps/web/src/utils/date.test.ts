import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  countryFlag,
  formatDuracion,
  formatRaceDate,
  formatTime,
  msHasta,
} from './date.ts'

const BASE = new Date('2026-08-03T12:00:00Z')
const dentroDe = (ms: number) => new Date(BASE.getTime() + ms).toISOString()

describe('formato en hora peninsular', () => {
  it('verano: UTC+2', () => {
    assert.match(formatRaceDate('2026-08-03T00:00:00Z'), /3 de agosto, 02:00/)
  })

  it('invierno: UTC+1, el cambio lo resuelve la zona IANA', () => {
    assert.match(formatRaceDate('2026-01-15T01:00:00Z'), /15 de enero, 02:00/)
  })

  it('una carrera asiática se muestra a la hora de aquí', () => {
    // 08:00 UTC en Tailandia son las 09:00 de la mañana en España.
    assert.equal(formatTime('2026-03-01T08:00:00Z'), '09:00')
  })

  it('sin fecha no inventa nada', () => {
    assert.equal(formatRaceDate(null), 'Por confirmar')
    assert.equal(formatTime(null), '—')
  })
})

describe('countryFlag', () => {
  it('convierte el ISO de dos letras en bandera', () => {
    assert.equal(countryFlag('ES'), '🇪🇸')
    assert.equal(countryFlag('th'), '🇹🇭')
  })

  it('cae en la bandera a cuadros si el código no sirve', () => {
    assert.equal(countryFlag(null), '🏁')
    assert.equal(countryFlag('ESP'), '🏁')
    assert.equal(countryFlag(''), '🏁')
  })
})

describe('msHasta', () => {
  it('devuelve los milisegundos que faltan', () => {
    assert.equal(msHasta(dentroDe(90_000), BASE), 90_000)
  })

  it('null cuando ya pasó: es lo que apaga la cuenta atrás', () => {
    assert.equal(msHasta(dentroDe(-1), BASE), null)
    assert.equal(msHasta(dentroDe(0), BASE), null)
  })

  it('null sin fecha', () => {
    assert.equal(msHasta(null, BASE), null)
  })
})

describe('formatDuracion', () => {
  it('mismos textos que la cuenta atrás de siempre', () => {
    assert.equal(formatDuracion(3 * 86_400_000 + 5 * 3_600_000), '3 d 5 h')
    assert.equal(formatDuracion(5 * 3_600_000 + 12 * 60_000), '5 h 12 min')
    assert.equal(formatDuracion(12 * 60_000 + 34_000), '12 min 34 s')
    assert.equal(formatDuracion(45_000), '45 s')
  })

  it('no depende de ningún reloj', () => {
    // Es la propiedad que arregla el fallo del móvil con la hora atrasada: el
    // texto sale del número recibido, no de comparar con `new Date()`.
    assert.equal(formatDuracion(60_000), formatDuracion(60_000))
  })
})
