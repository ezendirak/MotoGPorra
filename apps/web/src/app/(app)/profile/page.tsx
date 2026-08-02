import type { Metadata } from 'next'
import Link from 'next/link'

import { logout } from '@/lib/auth/actions'
import { getProfile, getUser, isAdmin } from '@/lib/auth/session'
import { getMyHistory } from '@/services/standings.service'
import { countryFlag } from '@/utils/date'

export const metadata: Metadata = { title: 'Perfil' }

const MEDALLAS = ['🥇', '🥈', '🥉'] as const

export default async function ProfilePage() {
  const [user, profile, historial, esAdmin] = await Promise.all([
    getUser(),
    getProfile(),
    getMyHistory(),
    isAdmin(),
  ])

  const total = historial.reduce((suma, fila) => suma + fila.points, 0)

  return (
    <main className="flex flex-col gap-6 px-5 pt-10">
      <header className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-xl font-bold text-white">
          {(profile?.display_name ?? '?').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white">
            {profile?.display_name ?? 'Piloto'}
          </h1>
          <p className="truncate text-sm text-zinc-500">{user?.email}</p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <dt className="text-xs text-zinc-500">Puntos</dt>
          <dd className="mt-0.5 text-2xl font-bold text-white tabular-nums">{total}</dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <dt className="text-xs text-zinc-500">Carreras jugadas</dt>
          <dd className="mt-0.5 text-2xl font-bold text-white tabular-nums">
            {historial.length}
          </dd>
        </div>
      </dl>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Tu histórico</h2>

        {historial.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400">
            Todavía no has puntuado. Apuesta a la próxima carrera para empezar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {historial.map((fila) => (
              <li
                key={fila.raceId}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <span className="text-xl" aria-hidden="true">
                  {countryFlag(fila.countryCode)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {fila.circuitName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    R{fila.round} · {fila.kind === 'sprint' ? 'Sprint' : 'Carrera'}
                  </p>
                </div>
                <span className="flex shrink-0 gap-0.5 text-xs" aria-hidden="true">
                  {[1, 2, 3].map((pos, i) => (
                    <span
                      key={pos}
                      title={`${MEDALLAS[i]} ${fila.breakdown[String(pos)] ? 'acertado' : 'fallado'}`}
                    >
                      {fila.breakdown[String(pos)] ? '✅' : '❌'}
                    </span>
                  ))}
                </span>
                <span className="w-6 shrink-0 text-right font-bold text-white tabular-nums">
                  {fila.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        Única entrada al panel: no va en la navegación inferior porque es un
        destino ocasional y ocuparía un hueco de los cuatro a quien no lo usa.
      */}
      {esAdmin && (
        <Link
          href="/admin"
          className="flex h-12 items-center justify-center rounded-xl border border-zinc-800 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
        >
          Administración
        </Link>
      )}

      <form action={logout} className="pt-2">
        <button
          type="submit"
          className="h-12 w-full rounded-xl border border-zinc-800 text-sm font-medium text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  )
}
