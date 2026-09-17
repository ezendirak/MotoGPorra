'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { useCountdown } from '@/hooks/use-countdown'

/**
 * Tiempo que queda para el cierre de apuestas, avanzando en vivo.
 *
 * Al llegar a cero pide un `router.refresh()`: el estado de la carrera lo
 * calcula el servidor a partir de `closes_at`, así que sin refrescar el botón
 * de apostar seguiría ahí y llevaría a un formulario que la RLS ya rechaza.
 * Refrescar hace que la pantalla cuente lo mismo que la base de datos.
 *
 * El tiempo restante llega en milisegundos desde el servidor y se descuenta
 * con un reloj monótono: el del dispositivo no participa. Un móvil con la hora
 * atrasada llegaba a enseñar «Cierra en 6 min» con la Q1 ya rodando.
 *
 * Es una mejora, no la regla: quien manda sobre el cierre es `place_bet` con el
 * reloj del servidor (§8.3). Esta cuenta atrás solo informa, y un reloj de
 * cliente adelantado no cuela ninguna apuesta tardía.
 */
export function RaceCountdown({
  closesAt,
  restanteMs,
  className,
  prefijo = '',
  textoCerrado = 'cerrado',
}: {
  closesAt: string | null
  /**
   * Milisegundos que faltaban al renderizar, calculados EN SERVIDOR. `null` si
   * ya estaba cerrada. Es la única fuente de la cuenta: el reloj del navegador
   * no se consulta en ningún momento.
   */
  restanteMs: number | null
  className?: string
  /**
   * Texto delante de la cuenta atrás («Cierra »). Va dentro del componente y no
   * en quien lo usa porque al cerrarse la frase entera se sustituye: dejarlo
   * fuera daría «Cierra El plazo está a punto de cerrarse».
   */
  prefijo?: string
  /**
   * Qué decir cuando ya no queda tiempo. Se parametriza porque el matiz cambia
   * según dónde: en la home basta «cerrado», pero en el formulario de apuesta
   * el refresco aún no ha llegado y lo honesto es «a punto de cerrarse».
   */
  textoCerrado?: string
}) {
  const restante = useCountdown(restanteMs)
  const router = useRouter()
  const yaRefrescado = useRef(false)

  useEffect(() => {
    // `restanteMs` null significa que ya estaba cerrada al renderizar: no hay
    // ninguna transición que atender y refrescar sería un bucle.
    if (restante !== null || restanteMs === null || yaRefrescado.current) return

    yaRefrescado.current = true
    router.refresh()
  }, [restante, restanteMs, router])

  if (restante === null) {
    return <span className={className}>{textoCerrado}</span>
  }

  return (
    <span className={className}>
      {/* `time` marca que esto es una duración, y `aria-live="off"` evita que
          un lector de pantalla recite el número entero cada segundo. */}
      <time dateTime={closesAt ?? undefined} aria-live="off">
        {prefijo}en {restante}
      </time>
    </span>
  )
}
