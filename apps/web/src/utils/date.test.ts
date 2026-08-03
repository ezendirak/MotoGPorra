import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { countryFlag, formatRaceDate, formatTime, timeUntilPrecise } from './date.ts'

const BASE = new Date('2026-08-03T12:00:00Z')
const dentroDe = (ms: number) => new Date(BASE.getTime() + ms).toISOString()

describe('timeUntilPrecise', () => {
  it('por encima del día muestra días y horas', () => {
    assert.equal(
      timeUntilPrecise(dentroDe(3 * 86_400_000 + 5 * 3_600_000), BASE),
      '3 d 5 h',
    )
  })

  it('por encima de la hora muestra horas y minutos', () => {
    assert.equal(
      timeUntilPrecise(dentroDe(5 * 3_600_000 + 12 * 60_000), BASE),
      '5 h 12 min',
    )
  })

  it('en la última hora aparecen los segundos, que es cuando importan', () => {
    assert.equal(timeUntilPrecise(dentroDe(12 * 60_000 + 34_000), BASE), '12 min 34 s')
  })

  it('en el último minuto sobra el «0 min»', () => {
    assert.equal(timeUntilPrecise(dentroDe(45_000), BASE), '45 s')
  })

  it('el minuto exacto sigue siendo minutos', () => {
    assert.equal(timeUntilPrecise(dentroDe(60_000), BASE), '1 min 0 s')
  })

  it('el instante del cierre ya es null: a las 0 no se apuesta', () => {
    assert.equal(timeUntilPrecise(dentroDe(0), BASE), null)
  })

  it('pasado el cierre devuelve null, no un negativo', () => {
    assert.equal(timeUntilPrecise(dentroDe(-5_000), BASE), null)
  })

  it('sin fecha devuelve null', () => {
    assert.equal(timeUntilPrecise(null, BASE), null)
  })
})

/**
 * Estas son las que habrían cazado el fallo de la fase 10: sin fijar la zona,
 * el resultado dependía de dónde corriera el proceso —UTC en Vercel— y la hora
 * de la carrera salía dos horas antes de la real.
 */
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
