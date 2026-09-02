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

      <TablaDePuntos />
    </main>
  )
}

/**
 * Las reglas, a la vista de todos.
 *
 * Se enseña la tabla entera y no una frase resumen porque la puntuación **no
 * es aditiva**: acertar 1º y 2º da 10 puntos, no los 7 que saldrían de sumar
 * sus valores sueltos. Cualquier resumen corto mentiría, y discutir puntos con
 * los amigos es medio juego.
 */
function TablaDePuntos() {
  const FILAS = [
    { patron: [true, true, true], puntos: 15 },
    { patron: [true, true, false], puntos: 10 },
    { patron: [true, false, true], puntos: 7 },
    { patron: [true, false, false], puntos: 5 },
    { patron: [false, true, true], puntos: 3 },
    { patron: [false, true, false], puntos: 2 },
    { patron: [false, false, true], puntos: 1 },
  ]

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
      <h2 className="text-xs font-semibold text-zinc-400">Cómo se puntúa</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Según qué posiciones del podio aciertes.
      </p>

      <ul className="mt-3 flex flex-col gap-1">
        {FILAS.map(({ patron, puntos }) => (
          <li
            key={puntos}
            className="flex items-center gap-3 text-xs text-zinc-400 tabular-nums"
          >
            <span className="flex gap-1" aria-hidden="true">
              {patron.map((acierto, i) => (
                <span
                  key={i}
                  className={
                    acierto
                      ? 'flex h-5 w-5 items-center justify-center rounded bg-emerald-950/60 text-emerald-400'
                      : 'flex h-5 w-5 items-center justify-center rounded bg-zinc-800/60 text-zinc-600'
                  }
                >
                  {acierto ? i + 1 : '·'}
                </span>
              ))}
            </span>
            <span className="sr-only">
              {patron.map((a, i) => `${i + 1}º ${a ? 'acertado' : 'fallado'}`).join(', ')}
              :
            </span>
            <span className="font-medium text-zinc-300">
              {puntos} {puntos === 1 ? 'punto' : 'puntos'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
