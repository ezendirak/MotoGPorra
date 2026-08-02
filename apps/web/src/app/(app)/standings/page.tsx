import type { Metadata } from 'next'

import { PositionDelta } from '@/components/standings/position-delta'
import { StandingsRealtime } from '@/components/standings/standings-realtime'
import { getStandingsWithTrend } from '@/services/standings.service'

export const metadata: Metadata = { title: 'Clasificación' }

const MEDALLAS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default async function StandingsPage() {
  const clasificacion = await getStandingsWithTrend()

  return (
    <main className="flex flex-col gap-6 px-5 pt-10">
      <StandingsRealtime />

      <header>
        <h1 className="text-2xl font-bold text-white">Clasificación</h1>
        <p className="mt-1 text-sm text-zinc-400">Temporada 2026</p>
      </header>

      {clasificacion.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400">
          Todavía no hay puntuaciones. Aparecerán en cuanto se dispute la primera carrera
          con apuestas.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/40">
          {clasificacion.map((fila) => (
            <li key={fila.user_id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="w-7 shrink-0 text-center text-sm font-semibold text-zinc-400">
                {MEDALLAS[fila.position ?? 0] ?? fila.position}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {fila.display_name}
                </p>
                <p className="text-xs text-zinc-500">
                  {fila.races_played} carreras · {fila.total_exact_hits} aciertos
                </p>
              </div>

              <PositionDelta delta={fila.delta} />

              <span className="w-8 shrink-0 text-right text-lg font-bold text-white tabular-nums">
                {fila.total_points}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="text-center text-xs text-zinc-600">
        1 punto por cada posición del podio acertada. Sprint y carrera puntúan igual.
      </p>
    </main>
  )
}
