'use client'

import { useEffect, useState } from 'react'

import { formatDuracion } from '@/utils/date'

/**
 * Cuenta atrás que avanza sola hasta el cierre.
 *
 * **No usa el reloj del dispositivo.** Recibe del servidor cuántos
 * milisegundos faltaban en el momento de renderizar, y descuenta desde ahí con
 * `performance.now()`, que es monótono y no depende de la hora del sistema.
 *
 * El porqué es un fallo real: un móvil con la hora atrasada unos minutos veía
 * «Cierra en 6 min» cuando la Q1 ya había empezado, no disparaba el refresco
 * automático y dejaba el formulario en pantalla. Nadie llegó a colar una
 * apuesta —`place_bet` valida con el reloj del servidor—, pero la aplicación
 * le estaba diciendo a esa persona que todavía podía apostar. Comparar
 * `closes_at` con `new Date()` del navegador es exactamente lo que hay que
 * evitar aquí.
 *
 * `msIniciales` viene calculado en servidor, así que el primer render coincide
 * con el HTML recibido por construcción y no hay error de hidratación.
 *
 * El `setState` vive dentro del callback del intervalo y no en el cuerpo del
 * efecto, que es lo que prohíbe `react-hooks/set-state-in-effect`.
 *
 * Devuelve `null` cuando ya no queda tiempo.
 */
export function useCountdown(msIniciales: number | null) {
  const [restante, setRestante] = useState<string | null>(
    msIniciales === null ? null : formatDuracion(msIniciales),
  )

  useEffect(() => {
    if (msIniciales === null) return

    // Origen monótono: no lo mueve ni un cambio de hora del sistema ni un
    // ajuste automático de zona horaria a mitad de la cuenta.
    const origen = performance.now()

    const intervalo = setInterval(() => {
      const quedan = msIniciales - (performance.now() - origen)
      // React descarta el render si el estado no cambia, así que llamar cada
      // segundo no repinta nada mientras el texto siga siendo «3 d 5 h».
      setRestante(quedan > 0 ? formatDuracion(quedan) : null)
    }, 1000)

    return () => clearInterval(intervalo)
  }, [msIniciales])

  return restante
}
