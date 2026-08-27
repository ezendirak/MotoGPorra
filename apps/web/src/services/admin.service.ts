import { isAdmin } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
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
  /** `null` cuando no se ha podido consultar `auth.users` (ver `getUsers`). */
  email: string | null
  /** `null` si se desconoce; `false` significa registrado y sin confirmar. */
  emailConfirmed: boolean | null
}

/**
 * Email y confirmación de cada cuenta, leídos de `auth.users`.
 *
 * Es el **único** sitio de la aplicación web que usa `service_role`, y hace
 * falta porque `auth.users` no se expone por la Data API: no hay política RLS
 * que conceda esto, ni la habrá.
 *
 * Por eso comprueba el rol **por su cuenta**. En el resto de funciones la RLS es
 * la red de seguridad y el `requireAdmin()` es solo experiencia de usuario;
 * aquí no hay red debajo, así que la comprobación es la autorización de verdad.
 *
 * Devuelve un mapa vacío si falta la clave en el entorno, en lugar de reventar:
 * el panel funciona sin esto, solo enseña menos.
 */
async function getAuthDetails(): Promise<
  Map<string, { email: string | null; confirmed: boolean }>
> {
  if (!(await isAdmin())) {
    throw new Error('Solo un administrador puede consultar las cuentas')
  }

  try {
    const admin = createAdminClient()

    // 200 por página cubre de sobra una porra de amigos. Si algún día no
    // llegara, hay que paginar: `listUsers` no devuelve todo de una vez.
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) throw error

    return new Map(
      data.users.map((u) => [
        u.id,
        {
          email: u.email ?? null,
          // `email_confirmed_at` es OPCIONAL (`?: string`), no nullable: en una
          // cuenta sin confirmar el campo no viene, así que vale `undefined`.
          // Compararlo con `null` daba `true` para todo el mundo y ninguna
          // cuenta aparecía como pendiente.
          confirmed: Boolean(u.email_confirmed_at),
        },
      ]),
    )
  } catch (error) {
    console.error('No se pudo consultar auth.users:', error)
    return new Map()
  }
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
 * Ordena las cuentas sin confirmar primero: son las que piden una decisión
 * —esperar o purgar—, y el resto de la lista no cambia nunca.
 */
export async function getUsers(): Promise<AdminUser[]> {
  const supabase = await createClient()

  const [perfiles, roles, participaciones, cuentas] = await Promise.all([
    supabase.from('profiles').select('id, display_name, avatar_url'),
    supabase.from('user_roles').select('user_id, role'),
    supabase.from('season_participants').select('user_id, joined_at'),
    getAuthDetails(),
  ])

  const error = perfiles.error ?? roles.error ?? participaciones.error
  if (error) throw new Error(`No se pudieron cargar los usuarios: ${error.message}`)

  const rolPorUsuario = new Map(roles.data?.map((r) => [r.user_id, r.role]))
  const altaPorUsuario = new Map(
    participaciones.data?.map((p) => [p.user_id, p.joined_at]),
  )

  return (perfiles.data ?? [])
    .map((perfil) => {
      const cuenta = cuentas.get(perfil.id)

      return {
        userId: perfil.id,
        displayName: perfil.display_name,
        avatarUrl: perfil.avatar_url,
        role: rolPorUsuario.get(perfil.id) ?? 'player',
        joinedAt: altaPorUsuario.get(perfil.id) ?? null,
        email: cuenta?.email ?? null,
        emailConfirmed: cuenta ? cuenta.confirmed : null,
      }
    })
    .sort((a, b) => {
      if (a.emailConfirmed === false && b.emailConfirmed !== false) return -1
      if (b.emailConfirmed === false && a.emailConfirmed !== false) return 1
      return a.displayName.localeCompare(b.displayName, 'es')
    })
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

/**
 * Vuelve a puntuar una carrera a partir del resultado que ya está importado.
 *
 * Hace falta porque `recalculate_race_scores` está **revocada para
 * `authenticated`** y solo concedida a `service_role`: la puntuación no es algo
 * que un jugador pueda disparar. Normalmente la llama el sincronizador al
 * importar el resultado, y con eso basta.
 *
 * El caso que no cubre —y para el que existe esto— es reabrir una carrera ya
 * disputada: la apuesta nueva se guarda, pero el resultado ya estaba importado,
 * así que el sync no vuelve a tocarlo y nadie recalcula. Sin este botón, esa
 * apuesta no puntuaría jamás.
 *
 * Como usa `service_role`, que bypasa la RLS, comprueba el rol por su cuenta:
 * aquí no hay red de seguridad debajo.
 */
export async function recalcularPuntuaciones(raceId: string): Promise<number> {
  if (!(await isAdmin())) {
    throw new Error('Solo un administrador puede recalcular')
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('recalculate_race_scores', {
    p_race_id: raceId,
  })

  if (error) throw new Error(`No se pudo recalcular: ${error.message}`)

  // La función devuelve cuántas filas de puntuación ha escrito.
  return typeof data === 'number' ? data : 0
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
