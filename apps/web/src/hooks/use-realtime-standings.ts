'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { createClient } from '@/lib/supabase/client'

/**
 * Refresca la clasificación cuando el sincronizador escribe puntuaciones.
 *
 * **No reconstruye la tabla en cliente**: se limita a pedir un
 * `router.refresh()`, y es el servidor quien vuelve a calcular la clasificación
 * con la RLS del usuario aplicada. Es la decisión de §2.2 — Realtime como
 * mejora y no como base. Si la conexión falla o el navegador la corta al pasar
 * a segundo plano, la página sigue siendo correcta: solo deja de actualizarse
 * sola, y basta recargar.
 *
 * Duplicar aquí la lógica de agregación y de `rank()` sería la alternativa, y
 * significaría tener dos definiciones de la clasificación que acabarían
 * discrepando justo el domingo que alguien mira el móvil.
 */
export function useRealtimeStandings() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const canal = supabase
      .channel('clasificacion')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'race_scores' },
        () => {
          // Un recálculo toca decenas de filas y dispara un evento por cada
          // una. `router.refresh()` es idempotente y Next.js agrupa las
          // peticiones seguidas, así que no hace falta amortiguarlo a mano.
          router.refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [router])
}
