import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

export type RaceView = Database['public']['Views']['races_view']['Row']
export type RaceStatus = Database['public']['Enums']['race_status']

/**
 * Todas las consultas de carreras leen de `races_view` y nunca de `races`.
 *
 * El estado se calcula en la vista a partir de `closes_at` y del resultado
 * oficial; preguntarle a la tabla obligaría a duplicar aquí la regla del
 * cierre, y dos definiciones de "abierta" acaban divergiendo.
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

export async function getNextRace(): Promise<RaceView | null> {
  const [next] = await getOpenRaces(1)
  return next ?? null
}

/** Calendario completo de la temporada, en orden cronológico. */
export async function getSeasonCalendar(): Promise<RaceView[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('races_view')
    .select('*')
    .order('scheduled_at', { ascending: true })

  if (error) throw new Error(`No se pudo cargar el calendario: ${error.message}`)
  return data ?? []
}

export async function getRaceById(raceId: string): Promise<RaceView | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('races_view')
    .select('*')
    .eq('id', raceId)
    .maybeSingle()

  if (error) throw new Error(`No se pudo cargar la carrera: ${error.message}`)
  return data
}

export type ResultEntry = {
  position: number | null
  is_classified: boolean
  total_time: string | null
  gap_to_first: string | null
  championship_points: number | null
  team_name: string | null
  riders: {
    id: string
    full_name: string
    country_code: string | null
    headshot_url: string | null
    number_image_url: string | null
  } | null
}

/** Clasificación oficial de una carrera, ordenada por posición. */
export async function getRaceResult(raceId: string): Promise<ResultEntry[]> {
  const supabase = await createClient()

  const { data: header } = await supabase
    .from('race_results')
    .select('id')
    .eq('race_id', raceId)
    .eq('status', 'official')
    .maybeSingle()

  if (!header) return []

  const { data, error } = await supabase
    .from('race_result_entries')
    .select(
      'position,is_classified,total_time,gap_to_first,championship_points,team_name,riders(id,full_name,country_code,headshot_url,number_image_url)',
    )
    .eq('race_result_id', header.id)
    // Los no clasificados van al final: `position` es null y NULLS LAST lo
    // resuelve sin tener que reordenar en el cliente.
    .order('position', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`No se pudo cargar el resultado: ${error.message}`)
  return (data ?? []) as ResultEntry[]
}

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
