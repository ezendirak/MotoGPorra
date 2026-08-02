import type { Metadata } from 'next'

import { UserRoleControl } from '@/components/admin/user-role-control'
import { requireAdmin } from '@/lib/auth/session'
import { getUsers } from '@/services/admin.service'
import { formatShortDate } from '@/utils/date'

export const metadata: Metadata = { title: 'Participantes' }

/**
 * Participantes y roles.
 *
 * El email y la confirmación salen de `auth.users` vía `service_role`, porque
 * la Data API no expone ese esquema. Si falta `SUPABASE_SERVICE_ROLE_KEY` en el
 * entorno, ambos llegan como `null` y la pantalla lo dice en vez de fallar: los
 * roles siguen gestionándose igual.
 *
 * Marcar las cuentas sin confirmar importa porque el trigger crea perfil, rol e
 * inscripción en el `signUp` y no al confirmar: una cuenta a medias ya ocupa
 * sitio en la lista y ya reserva su nombre visible.
 */
export default async function AdminUsersPage() {
  const [admin, users] = await Promise.all([requireAdmin(), getUsers()])

  const sinConfirmar = users.filter((u) => u.emailConfirmed === false).length
  // Si ninguna cuenta trae email, es que no se pudo consultar `auth.users`.
  const sinAcceso = users.length > 0 && users.every((u) => u.emailConfirmed === null)

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-8">
      <header>
        <h1 className="text-lg font-bold text-white">Participantes</h1>
        <p className="mt-1 text-xs text-zinc-500">
          {users.length} {users.length === 1 ? 'inscrito' : 'inscritos'} en la temporada.
        </p>
      </header>

      {sinAcceso && (
        <p className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400">
          Sin <code>SUPABASE_SERVICE_ROLE_KEY</code> en el entorno no se puede leer{' '}
          <code>auth.users</code>: no hay email ni estado de confirmación. Los roles
          funcionan igual.
        </p>
      )}

      {sinConfirmar > 0 && (
        <p className="rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-xs text-amber-200">
          {sinConfirmar === 1
            ? 'Una cuenta se registró y no ha confirmado su email.'
            : `${sinConfirmar} cuentas se registraron y no han confirmado su email.`}{' '}
          No pueden entrar, pero ya ocupan su nombre visible.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {users.map((user) => (
          <li
            key={user.userId}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">
                {user.displayName}
                {user.userId === admin.id && (
                  <span className="ml-2 text-xs text-zinc-500">(tú)</span>
                )}
                {user.emailConfirmed === false && (
                  <span className="ml-2 rounded border border-amber-900/60 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                    sin confirmar
                  </span>
                )}
              </p>
              {user.email && (
                <p className="truncate text-xs text-zinc-500">{user.email}</p>
              )}
              <p className="text-xs text-zinc-500">
                {user.role === 'admin' ? 'Administrador' : 'Jugador'}
                {user.joinedAt && ` · desde ${formatShortDate(user.joinedAt)}`}
              </p>
            </div>

            <UserRoleControl
              userId={user.userId}
              role={user.role}
              esUnoMismo={user.userId === admin.id}
            />
          </li>
        ))}
      </ul>
    </main>
  )
}
