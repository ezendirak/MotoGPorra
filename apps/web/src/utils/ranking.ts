/**
 * Cálculo de posiciones de la clasificación. Funciones puras.
 *
 * Vive aquí y no en `services/` porque no consulta nada: recibe totales y
 * devuelve puestos. Eso la hace comprobable sin base de datos, que importa más
 * de lo que parece — una clasificación mal calculada no da ningún error, solo
 * miente, y nadie lo nota hasta que alguien discute su puesto.
 */

/**
 * Puesto de cada usuario a partir de sus puntos totales.
 *
 * Replica el `rank()` de la vista `season_standings`: **los empates comparten
 * posición y la siguiente salta** (1, 2, 2, 4), que es la regla acordada — sin
 * criterios de desempate. La fórmula «uno más los que tienen estrictamente más
 * puntos» produce exactamente eso sin ordenar nada.
 */
export function posicionesPorPuntos(totales: Map<string, number>): Map<string, number> {
  const puntos = [...totales.values()]

  return new Map(
    [...totales].map(([userId, propios]) => [
      userId,
      1 + puntos.filter((p) => p > propios).length,
    ]),
  )
}

/**
 * Puestos ganados entre dos clasificaciones. Positivo = ha subido.
 *
 * Se resta al revés de lo que parece natural porque en una clasificación el
 * número pequeño es el bueno: pasar del 5º al 3º son **+2 puestos ganados**.
 *
 * Devuelve `null` cuando no hay con qué comparar — alguien que acaba de
 * puntuar por primera vez no ha subido desde ninguna parte, y pintarle un
 * ascenso enorme sería mentir.
 */
export function puestosGanados(
  posicionAnterior: number | undefined,
  posicionActual: number | null,
): number | null {
  if (posicionAnterior === undefined || posicionActual === null) return null
  return posicionAnterior - posicionActual
}
