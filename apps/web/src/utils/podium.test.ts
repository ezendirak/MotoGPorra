import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { colocarPiloto } from './podium.ts'

const [A, B, C, D] = ['piloto-a', 'piloto-b', 'piloto-c', 'piloto-d']

describe('colocarPiloto', () => {
  it('coloca en una posición vacía sin tocar el resto', () => {
    assert.deepEqual(colocarPiloto([A, null, C], 1, B), [A, B, C])
  })

  it('sustituye al que hubiera en esa posición', () => {
    assert.deepEqual(colocarPiloto([A, B, C], 1, D), [A, D, C])
  })

  it('intercambia cuando el piloto ya ocupaba otra posición', () => {
    // Es la queja que originó esto: subir al tercero al primer puesto sin
    // tener que quitarlo antes y buscarlo otra vez.
    assert.deepEqual(colocarPiloto([A, B, C], 0, C), [C, B, A])
  })

  it('con el destino vacío, intercambiar equivale a mover y dejar hueco', () => {
    assert.deepEqual(colocarPiloto([A, null, C], 1, A), [null, A, C])
  })

  it('reelegir al que ya estaba ahí no cambia nada', () => {
    assert.deepEqual(colocarPiloto([A, B, C], 1, B), [A, B, C])
  })

  it('nunca deja un piloto repetido', () => {
    const casos: [(string | null)[], number, string][] = [
      [[A, B, C], 0, B],
      [[A, B, C], 2, A],
      [[A, null, C], 2, A],
      [[null, null, null], 1, A],
    ]
    for (const [picks, indice, rider] of casos) {
      const resultado = colocarPiloto(picks, indice, rider)
      const puestos = resultado.filter((p): p is string => p !== null)
      assert.equal(
        new Set(puestos).size,
        puestos.length,
        `repetido en ${JSON.stringify(resultado)}`,
      )
    }
  })

  it('no muta el array recibido', () => {
    const original: (string | null)[] = [A, B, C]
    colocarPiloto(original, 0, C)
    assert.deepEqual(original, [A, B, C])
  })
})
