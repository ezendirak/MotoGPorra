import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'
import { posicionesPorPuntos, puestosGanados } from '@/utils/ranking'

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

export interface StandingWithTrend extends Standing {
  /**
   * Puestos ganados desde la carrera anterior. Positivo = ha subido.
   * `null` cuando no había clasificación previa con la que comparar: primera
   * carrera de la temporada, o alguien que acaba de puntuar por primera vez.
   */
  delta: number | null
}

/**
 * Clasificación con la variación de puesto respecto a la carrera anterior.
 *
 * "Anterior" es la última carrera con resultado, no la última del calendario:
 * comparar contra un Gran Premio que aún no se ha corrido daría cero siempre.
 *
 * El cálculo de puestos vive en `utils/ranking`, que es puro y está cubierto por
 * pruebas. Aquí queda solo el acarreo de datos. Se hace en JS y no en SQL porque
 * la posición *anterior* exige rehacer la clasificación excluyendo la última
 * carrera, y expresarlo como vista obliga a una ventana sobre un agregado
 * condicional; con ~20 usuarios y ~44 carreras son 880 filas.
 */
export async function getStandingsWithTrend(): Promise<StandingWithTrend[]> {
  const supabase = await createClient()
  const actual = await getStandings()

  if (actual.length === 0) return []

  const { data: puntuaciones } = await supabase
    .from('race_scores')
    .select('race_id, user_id, points')

  if (!puntuaciones?.length) return actual.map((fila) => ({ ...fila, delta: null }))

  // Cuál fue la última carrera puntuada, por horario y no por ronda: el sprint
  // y la carrera de un mismo GP comparten ronda.
  const { data: carreras } = await supabase
    .from('races_view')
    .select('id, scheduled_at')
    .in('id', [...new Set(puntuaciones.map((p) => p.race_id))])

  const ordenadas = (carreras ?? [])
    .filter((c) => c.scheduled_at !== null)
    .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))

  const ultima = ordenadas.at(-1)
  // Con una sola carrera puntuada no hay nada anterior contra lo que comparar.
  if (!ultima || ordenadas.length < 2) {
    return actual.map((fila) => ({ ...fila, delta: null }))
  }

  const previos = new Map<string, number>()
  for (const p of puntuaciones) {
    if (p.race_id === ultima.id || !p.user_id) continue
    previos.set(p.user_id, (previos.get(p.user_id) ?? 0) + p.points)
  }

  const posicionesPrevias = posicionesPorPuntos(previos)

  return actual.map((fila) => ({
    ...fila,
    delta: puestosGanados(
      fila.user_id ? posicionesPrevias.get(fila.user_id) : undefined,
      fila.position,
    ),
  }))
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
