import { logout } from '@/lib/auth/actions'
import { getProfile } from '@/lib/auth/session'
import { getNextRace, getOpenRaces, getSeasonProgress } from '@/services/races.service'
import { countryFlag, formatRaceDate, formatShortDate, timeUntil } from '@/utils/date'

/**
 * Home.
 *
 * En la fase 4 la próxima carrera llevará el formulario de apuesta y una
 * cuenta atrás en vivo. De momento muestra los datos ya sincronizados desde
 * MotoGP, que es lo que confirma que la cadena completa funciona.
 */
export default async function HomePage() {
  const [profile, next, upcoming, progress] = await Promise.all([
    getProfile(),
    getNextRace(),
    getOpenRaces(6),
    getSeasonProgress(),
  ])

  const restante = timeUntil(next?.closes_at ?? null)

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 pt-10">
      <header>
        <p className="text-sm text-zinc-400">Hola,</p>
        <h1 className="text-2xl font-bold text-white">
          {profile?.display_name ?? 'piloto'}
        </h1>
      </header>

      {next ? (
        <section className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-900/40 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-red-500 uppercase">
                Próxima {next.kind === 'sprint' ? 'sprint' : 'carrera'}
              </p>
              <h2 className="mt-1 text-lg leading-tight font-bold text-white">
                {next.event_name}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                {next.circuit_name} · Ronda {next.round}
              </p>
            </div>
            <span className="text-3xl" aria-hidden="true">
              {countryFlag(next.country_code)}
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">Se corre</dt>
              <dd className="mt-0.5 font-medium text-zinc-200">
                {formatRaceDate(next.scheduled_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Cierre de apuestas</dt>
              <dd className="mt-0.5 font-medium text-zinc-200">
                {restante ? `en ${restante}` : 'cerrado'}
              </dd>
            </div>
          </dl>
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-sm text-zinc-400">No hay carreras abiertas ahora mismo.</p>
        </section>
      )}

      {upcoming.length > 1 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">A continuación</h2>
          <ul className="flex flex-col gap-2">
            {upcoming.slice(1).map((race) => (
              <li
                key={race.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3"
              >
                <span className="text-xl" aria-hidden="true">
                  {countryFlag(race.country_code)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {race.circuit_name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {race.kind === 'sprint' ? 'Sprint' : 'Carrera'} · Ronda {race.round}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {formatShortDate(race.scheduled_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-zinc-600">
        Temporada 2026 · {progress.done} de {progress.total} sesiones disputadas
      </p>

      <form action={logout} className="mt-auto pt-4">
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
