import type { Metadata } from 'next'

import { RaceStatusControl } from '@/components/admin/race-status-control'
import { getRacesWithOverride } from '@/services/admin.service'
import { countryFlag, formatRaceDate } from '@/utils/date'

export const metadata: Metadata = { title: 'Carreras' }

type Carrera = Awaited<ReturnType<typeof getRacesWithOverride>>[number]

/**
 * Apertura y cierre excepcional.
 *
 * Se listan **todas** las carreras, incluidas las ya disputadas: reabrir una
 * carrera pasada es justo lo que hace falta para probar el ciclo completo sin
 * esperar al domingo. Las disputadas van dentro de un `<details>` plegado
 * porque son la mayoría y empujarían fuera de pantalla a las que aún se pueden
 * apostar — plegado con HTML y no con estado de React, que aquí no aporta nada.
 */
export default async function AdminRacesPage() {
  const calendario = await getRacesWithOverride()

  const disputada = (c: Carrera) => c.status === 'finished' && c.statusOverride === null
  const activas = calendario.filter((c) => !disputada(c))
  const pasadas = calendario.filter(disputada)

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
        {activas.map((carrera) => (
          <FilaCarrera key={carrera.id} carrera={carrera} />
        ))}
      </ul>

      {pasadas.length > 0 && (
        <details className="rounded-xl border border-zinc-800 bg-zinc-900/20">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-300 marker:text-zinc-600">
            Ya disputadas ({pasadas.length})
          </summary>

          <p className="px-4 pb-3 text-xs text-zinc-500">
            Reabrir una de estas guarda las apuestas nuevas, pero el sincronizador no
            reimporta un resultado que ya tiene: para que puntúen hay que pulsar
            «Recalcular puntuaciones» después.
          </p>

          <ul className="flex flex-col gap-2 px-2 pb-2">
            {pasadas.map((carrera) => (
              <FilaCarrera key={carrera.id} carrera={carrera} />
            ))}
          </ul>
        </details>
      )}
    </main>
  )
}

function FilaCarrera({ carrera }: { carrera: Carrera }) {
  if (!carrera.id) return null

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">
          {countryFlag(carrera.country_code)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-200">
            {carrera.circuit_name}
          </p>
          <p className="text-xs text-zinc-500">
            Ronda {carrera.round} · cierra {formatRaceDate(carrera.closes_at)}
          </p>
        </div>

        <span className="shrink-0 text-xs text-zinc-400">{carrera.status}</span>
      </div>

      {carrera.statusOverride !== null && (
        <p className="mt-2 rounded-lg bg-amber-950/40 px-3 py-1.5 text-xs text-amber-300">
          Estado forzado a «{carrera.statusOverride}»: el horario ya no manda en esta
          carrera.
        </p>
      )}

      <RaceStatusControl
        raceId={carrera.id}
        overrideActual={carrera.statusOverride}
        tieneResultado={carrera.has_official_result === true}
      />
    </li>
  )
}
