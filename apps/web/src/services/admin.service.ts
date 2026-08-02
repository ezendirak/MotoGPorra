import { createClient } from '@/lib/supabase/server'
import type { RaceView } from '@/services/races.service'
import type { Database } from '@/types/database.types'

export type SyncRun = Database['public']['Tables']['sync_runs']['Row']
export type AppRole = Database['public']['Enums']['app_role']
export type RaceStatus = Database['public']['Enums']['race_status']

/** Un participante con su rol, tal y como lo ve el panel. */
export interface AdminUser {
  userId: string
  displayName: string
  avatarUrl: string | null
  role: AppRole
  joinedAt: string | null
}

/**
 * Ninguna de estas funciones comprueba el rol.
 *
 * No es un descuido: quien manda es la RLS. `sync_runs` solo tiene política de
 * lectura para `internal.is_admin()`, así que a un jugador normal esta misma
 * consulta le devuelve cero filas en vez de datos. El `requireAdmin()` del
 * layout es experiencia de usuario — evita pintar un panel vacío—, no la
 * autorización.
 */
export async function getSyncRuns(limit = 20): Promise<SyncRun[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sync_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`No se pudo cargar el historial de sync: ${error.message}`)
  return data ?? []
}

/**
 * Participantes de la temporada activa con su rol.
 *
 * Se cruza en JS y no con un `select` anidado porque `user_roles` y
 * `season_participants` apuntan a `auth.users`, no a `profiles`: sin clave
 * foránea entre ellas, PostgREST no puede incrustar nada.
 *
 * No incluye el email ni si la cuenta está confirmada — ambos viven en
 * `auth.users`, que no expone la Data API. Haría falta el cliente
 * `service_role`; queda pendiente.
 */
export async function getUsers(): Promise<AdminUser[]> {
  const supabase = await createClient()

  const [perfiles, roles, participaciones] = await Promise.all([
    supabase.from('profiles').select('id, display_name, avatar_url'),
    supabase.from('user_roles').select('user_id, role'),
    supabase.from('season_participants').select('user_id, joined_at'),
  ])

  const error = perfiles.error ?? roles.error ?? participaciones.error
  if (error) throw new Error(`No se pudieron cargar los usuarios: ${error.message}`)

  const rolPorUsuario = new Map(roles.data?.map((r) => [r.user_id, r.role]))
  const altaPorUsuario = new Map(
    participaciones.data?.map((p) => [p.user_id, p.joined_at]),
  )

  return (perfiles.data ?? [])
    .map((perfil) => ({
      userId: perfil.id,
      displayName: perfil.display_name,
      avatarUrl: perfil.avatar_url,
      role: rolPorUsuario.get(perfil.id) ?? 'player',
      joinedAt: altaPorUsuario.get(perfil.id) ?? null,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
}

/**
 * Carreras del calendario con la excepción de estado, si la tienen.
 *
 * `races_view` **no** expone `status_override`: solo lo usa dentro del
 * `coalesce` que resuelve el estado final, y hace bien — para un jugador, que
 * una carrera esté cerrada porque toca o porque alguien la cerró a mano es
 * exactamente lo mismo. Pero el panel necesita distinguirlo, así que se lee de
 * `races` y se cruza aquí en vez de ensanchar la vista de todos.
 */
export async function getRacesWithOverride(): Promise<
  (RaceView & { statusOverride: RaceStatus | null })[]
> {
  const supabase = await createClient()

  const [vista, overrides] = await Promise.all([
    supabase.from('races_view').select('*').order('scheduled_at', { ascending: true }),
    supabase.from('races').select('id, status_override'),
  ])

  const error = vista.error ?? overrides.error
  if (error) throw new Error(`No se pudo cargar el calendario: ${error.message}`)

  const porId = new Map(overrides.data?.map((r) => [r.id, r.status_override]))

  return (vista.data ?? []).map((carrera) => ({
    ...carrera,
    statusOverride: (carrera.id
      ? (porId.get(carrera.id) ?? null)
      : null) as RaceStatus | null,
  }))
}

/**
 * Fuerza el estado de una carrera, o devuelve el control al cálculo automático
 * pasando `null`.
 *
 * `status_override` es lo único que se escribe: `closes_at` y el estado normal
 * siguen derivándose solos (§4.6). Así, quitar la excepción restaura la regla
 * sin tener que recordar qué valor tenía antes.
 */
export async function setRaceStatusOverride(
  raceId: string,
  status: RaceStatus | null,
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('races')
    .update({ status_override: status })
    .eq('id', raceId)

  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`)
}

/** Cambia el rol de un participante. */
export async function setUserRole(userId: string, role: AppRole): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('user_roles')
    .update({ role })
    .eq('user_id', userId)

  if (error) throw new Error(`No se pudo cambiar el rol: ${error.message}`)
}
