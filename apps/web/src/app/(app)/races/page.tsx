import type { Metadata } from 'next'

import { RaceCard } from '@/components/races/race-card'
import { getSeasonCalendar } from '@/services/races.service'

export const metadata: Metadata = { title: 'Carreras' }

/**
 * Calendario de la temporada.
 *
 * Se separan las pendientes de las disputadas porque son dos intenciones
 * distintas: «¿a qué apuesto ahora?» y «¿qué pasó?». Mezcladas en una lista
 * cronológica obligarían a desplazarse hasta el medio para encontrar lo único
 * accionable.
 */
export default async function RacesPage() {
  const calendario = await getSeasonCalendar()

  const pendientes = calendario.filter(
    (r) => r.status === 'open' || r.status === 'upcoming',
  )
  const disputadas = calendario
    .filter((r) => r.status === 'finished' || r.status === 'closed')
    .reverse()

  return (
    <main className="flex flex-col gap-6 px-5 pt-10">
      <header>
        <h1 className="text-2xl font-bold text-white">Carreras</h1>
        <p className="mt-1 text-sm text-zinc-400">Temporada 2026 · MotoGP</p>
      </header>

      {pendientes.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Por disputar</h2>
          <ul className="flex flex-col gap-2">
            {pendientes.map((race) => (
              <li key={race.id}>
                <RaceCard race={race} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {disputadas.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Disputadas</h2>
          <ul className="flex flex-col gap-2">
            {disputadas.map((race) => (
              <li key={race.id}>
                <RaceCard race={race} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {calendario.length === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400">
          El calendario todavía no se ha sincronizado.
        </p>
      )}
    </main>
  )
}
