'use client'

import { useEffect, useState } from 'react'

import { timeUntilPrecise } from '@/utils/date'

/**
 * Cuenta atrás que avanza sola hasta una fecha.
 *
 * `inicial` es obligatorio y viene calculado en servidor. Sin él habría que
 * calcularlo aquí con `new Date()`, y el reloj del cliente nunca coincide al
 * milisegundo con el del servidor: el primer render no cuadraría con el HTML
 * recibido y React avisaría de un error de hidratación. Con el valor de
 * servidor como estado inicial, el primer render es idéntico por construcción y
 * el primer tic ya corrige la diferencia.
 *
 * El `setState` vive dentro del callback del intervalo y no en el cuerpo del
 * efecto, que es lo que prohíbe `react-hooks/set-state-in-effect`.
 *
 * Devuelve `null` cuando ya ha pasado la fecha.
 */
export function useCountdown(iso: string | null, inicial: string | null) {
  const [restante, setRestante] = useState(inicial)

  useEffect(() => {
    if (!iso) return

    // Solo dentro del intervalo: llamarlo también aquí sería un `setState`
    // síncrono en el cuerpo del efecto. No hace falta, además — el valor de
    // servidor ya es correcto y el primer tic llega en un segundo.
    const intervalo = setInterval(() => {
      // React descarta el render si el estado no cambia, así que llamar cada
      // segundo no repinta nada mientras el texto siga siendo «3 d 5 h».
      setRestante(timeUntilPrecise(iso))
    }, 1000)

    return () => clearInterval(intervalo)
  }, [iso])

  return restante
}
