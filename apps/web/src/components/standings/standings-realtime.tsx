'use client'

import { useRealtimeStandings } from '@/hooks/use-realtime-standings'

/**
 * Activa el refresco en vivo de la clasificación. No pinta nada.
 *
 * Existe solo para que la página de clasificación siga siendo un Server
 * Component: montar aquí el `'use client'` deja el resto de la pantalla —tabla,
 * posiciones, medallas— renderizándose en servidor, sin mandar al navegador ni
 * una línea de la lógica de clasificación.
 */
export function StandingsRealtime() {
  useRealtimeStandings()
  return null
}
