import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { posicionesPorPuntos, puestosGanados } from './ranking.ts'

/**
 * Pruebas con el runner que trae Node, sin dependencias.
 *
 * Se ejecutan con `npm test`. Solo cubren lógica pura: lo que toca la base de
 * datos se comprueba contra el proyecto real en `supabase/tests/verify.mjs`,
 * porque la RLS y las funciones SQL solo son creíbles ejecutándose de verdad.
 */

const mapa = (...pares: [string, number][]) => new Map(pares)

describe('posicionesPorPuntos', () => {
  it('ordena sin empates', () => {
    const p = posicionesPorPuntos(mapa(['a', 10], ['b', 8], ['c', 5]))
    assert.equal(p.get('a'), 1)
    assert.equal(p.get('b'), 2)
    assert.equal(p.get('c'), 3)
  })

  it('los empates comparten puesto y el siguiente salta (decisión 4)', () => {
    const p = posicionesPorPuntos(mapa(['a', 10], ['b', 8], ['c', 8], ['d', 5]))
    assert.equal(p.get('a'), 1)
    assert.equal(p.get('b'), 2)
    assert.equal(p.get('c'), 2)
    // El salto es lo que distingue `rank()` de `dense_rank()`: 4, no 3.
    assert.equal(p.get('d'), 4)
  })

  it('un empate a tres deja libres el 2º y el 3º', () => {
    const p = posicionesPorPuntos(mapa(['a', 7], ['b', 7], ['c', 7], ['d', 1]))
    assert.equal(p.get('a'), 1)
    assert.equal(p.get('c'), 1)
    assert.equal(p.get('d'), 4)
  })

  it('empate total: todos primeros', () => {
    const p = posicionesPorPuntos(mapa(['a', 3], ['b', 3], ['c', 3]))
    assert.deepEqual([...p.values()], [1, 1, 1])
  })

  it('el cero puntúa como cualquier otro total', () => {
    const p = posicionesPorPuntos(mapa(['a', 2], ['b', 0], ['c', 0]))
    assert.equal(p.get('a'), 1)
    assert.equal(p.get('b'), 2)
    assert.equal(p.get('c'), 2)
  })

  it('sin participantes no revienta', () => {
    assert.equal(posicionesPorPuntos(new Map()).size, 0)
  })
})

describe('puestosGanados', () => {
  it('subir da positivo', () => {
    // Del 5º al 3º: dos puestos ganados.
    assert.equal(puestosGanados(5, 3), 2)
  })

  it('bajar da negativo', () => {
    assert.equal(puestosGanados(2, 4), -2)
  })

  it('mantenerse da cero, que no es lo mismo que no saber', () => {
    assert.equal(puestosGanados(3, 3), 0)
  })

  it('sin posición anterior devuelve null', () => {
    assert.equal(puestosGanados(undefined, 1), null)
  })

  it('sin posición actual devuelve null', () => {
    assert.equal(puestosGanados(4, null), null)
  })
})
