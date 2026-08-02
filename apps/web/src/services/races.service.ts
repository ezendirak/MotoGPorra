import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

export type RaceView = Database['public']['Views']['races_view']['Row']

/**
 * Próximas carreras abiertas a apuestas, en orden cronológico.
 *
 * Se lee de `races_view` y no de `races` porque el estado se calcula en la
 * vista: preguntarle a la tabla obligaría a duplicar aquí la regla del cierre,
 * y dos definiciones de "abierta" acaban divergiendo.
 */
export async function getOpenRaces(limit = 10): Promise<RaceView[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('races_view')
    .select('*')
    .eq('status', 'open')
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`No se pudieron cargar las carreras: ${error.message}`)
  return data ?? []
}

/** La siguiente carrera apostable, o `null` si la temporada ha terminado. */
export async function getNextRace(): Promise<RaceView | null> {
  const [next] = await getOpenRaces(1)
  return next ?? null
}

/** Número de carreras ya disputadas y total de la temporada. */
export async function getSeasonProgress(): Promise<{ done: number; total: number }> {
  const supabase = await createClient()

  const [{ count: total }, { count: done }] = await Promise.all([
    supabase.from('races').select('*', { count: 'exact', head: true }),
    supabase
      .from('races_view')
      .select('*', { count: 'exact', head: true })
      .in('status', ['closed', 'finished']),
  ])

  return { done: done ?? 0, total: total ?? 0 }
}
