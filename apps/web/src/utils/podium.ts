/**
 * Coloca un piloto en una posición del podio, intercambiando si hacía falta.
 *
 * Si el piloto ya ocupaba OTRA posición, las dos se intercambian. Si no
 * ocupaba ninguna, simplemente se coloca y quien estuviera ahí sale.
 *
 * El porqué del intercambio, en vez de mover y dejar el hueco: reordenar el
 * podio es lo que más se hace —subir al que habías puesto tercero— y con un
 * simple movimiento habría que rellenar el hueco a continuación. Cuando la
 * posición de destino está vacía, intercambiar da exactamente lo mismo que
 * mover, así que no se pierde nada.
 *
 * Nunca deja a un piloto repetido, que es lo que la base rechazaría con
 * `DUPLICATE_RIDER`.
 */
export function colocarPiloto(
  picks: readonly (string | null)[],
  indice: number,
  riderId: string,
): (string | null)[] {
  const origen = picks.indexOf(riderId)

  return picks.map((actual, i) => {
    if (i === indice) return riderId
    if (i === origen) return picks[indice] ?? null
    return actual
  })
}
