import type { Metadata } from 'next'

import { RaceStatusControl } from '@/components/admin/race-status-control'
import { getRacesWithOverride } from '@/services/admin.service'
import { countryFlag, formatRaceDate } from '@/utils/date'

export const metadata: Metadata = { title: 'Carreras' }

/**
 * Apertura y cierre excepcional.
 *
 * Se listan solo las carreras que aún se pueden tocar más las que ya tienen una
 * excepción puesta: el calendario entero son 44 filas con un formulario cada
 * una, y las de enero no le interesan a nadie en agosto.
 */
export default async function AdminRacesPage() {
  const calendario = await getRacesWithOverride()

  const relevantes = calendario.filter(
    (c) => c.status !== 'finished' || c.statusOverride !== null,
  )

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-8">
      <header>
        <h1 className="text-lg font-bold text-white">Carreras</h1>
        <p className="mt-1 text-xs text-zinc-500">
          El estado se calcula solo a partir del horario. Forzarlo es una excepción y se
          marca como tal.
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {relevantes.map((carrera) => (
          <li
            key={carrera.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl" aria-hidden="true">
                {countryFlag(carrera.country_code)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-200">
                  {carrera.circuit_name}
                </p>
                <p className="text-xs text-zinc-500">
                  {carrera.kind === 'sprint' ? 'Sprint' : 'Carrera'} · Ronda{' '}
                  {carrera.round} · cierra {formatRaceDate(carrera.closes_at)}
                </p>
              </div>

              <span className="shrink-0 text-xs text-zinc-400">{carrera.status}</span>
            </div>

            {carrera.statusOverride !== null && (
              <p className="mt-2 rounded-lg bg-amber-950/40 px-3 py-1.5 text-xs text-amber-300">
                Estado forzado a «{carrera.statusOverride}»: el horario ya no manda en
                esta carrera.
              </p>
            )}

            {carrera.id && (
              <RaceStatusControl
                raceId={carrera.id}
                overrideActual={carrera.statusOverride}
              />
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
