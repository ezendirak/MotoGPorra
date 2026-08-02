import type { Metadata } from 'next'

import { UserRoleControl } from '@/components/admin/user-role-control'
import { requireAdmin } from '@/lib/auth/session'
import { getUsers } from '@/services/admin.service'
import { formatShortDate } from '@/utils/date'

export const metadata: Metadata = { title: 'Participantes' }

/**
 * Participantes y roles.
 *
 * No enseña el email ni si la cuenta está confirmada: ambos viven en
 * `auth.users`, que la Data API no expone. Traerlos exige el cliente
 * `service_role` desde `lib/supabase/admin.ts`, y con él una variable de
 * entorno más en producción — se deja para cuando haga falta de verdad.
 *
 * La consecuencia práctica está anotada en DESIGN.md: una cuenta registrada y
 * sin confirmar ya aparece en esta lista, porque el trigger crea perfil, rol e
 * inscripción en el `signUp` y no al confirmar.
 */
export default async function AdminUsersPage() {
  const [admin, users] = await Promise.all([requireAdmin(), getUsers()])

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-8">
      <header>
        <h1 className="text-lg font-bold text-white">Participantes</h1>
        <p className="mt-1 text-xs text-zinc-500">
          {users.length} {users.length === 1 ? 'inscrito' : 'inscritos'} en la temporada.
        </p>
      </header>

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
              </p>
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
