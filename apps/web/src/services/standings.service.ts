import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

export type Standing = Database['public']['Views']['season_standings']['Row']

/**
 * Clasificación general de la temporada activa.
 *
 * `season_standings` deriva de `race_scores` y usa `rank()`, que produce
 * empates compartidos de forma natural (1, 2, 2, 4) — que es la regla
 * acordada. No hay criterio de desempate, así que no hay nada que ordenar
 * aquí más allá de la posición.
 */
export async function getStandings(): Promise<Standing[]> {
  const supabase = await createClient()

  const { data: season } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  if (!season) return []

  const { data, error } = await supabase
    .from('season_standings')
    .select('*')
    .eq('season_id', season.id)
    .order('position', { ascending: true })

  if (error) throw new Error(`No se pudo cargar la clasificación: ${error.message}`)
  return data ?? []
}

export type HistoryRow = {
  raceId: string
  points: number
  exactHits: number
  breakdown: Record<string, boolean>
  round: number | null
  kind: string | null
  circuitName: string | null
  countryCode: string | null
}

/** Histórico de puntuaciones del usuario actual, de más reciente a más antigua. */
export async function getMyHistory(): Promise<HistoryRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('race_scores')
    .select('race_id,points,exact_hits,breakdown')
    .eq('user_id', user.id)

  if (error) throw new Error(`No se pudo cargar tu histórico: ${error.message}`)
  if (!data?.length) return []

  // `races_view` ya trae circuito, ronda y país resueltos. Cruzarlo aquí es
  // más legible que encadenar tres niveles de embed en PostgREST, y son dos
  // consultas sobre tablas pequeñas.
  const { data: vistas } = await supabase
    .from('races_view')
    .select('id,round,kind,circuit_name,country_code')
    .in(
      'id',
      data.map((row) => row.race_id),
    )

  const porId = new Map((vistas ?? []).map((v) => [v.id, v]))

  return (data ?? [])
    .map((row) => {
      const vista = porId.get(row.race_id)
      return {
        raceId: row.race_id,
        points: row.points,
        exactHits: row.exact_hits,
        breakdown: (row.breakdown ?? {}) as Record<string, boolean>,
        round: vista?.round ?? null,
        kind: vista?.kind ?? null,
        circuitName: vista?.circuit_name ?? null,
        countryCode: vista?.country_code ?? null,
      }
    })
    .sort((a, b) => (b.round ?? 0) - (a.round ?? 0))
}
