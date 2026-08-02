import type { Metadata } from 'next'

import { SyncTrigger } from '@/components/admin/sync-trigger'
import { getSyncRuns, type SyncRun } from '@/services/admin.service'
import { puedeDispararSync } from '@/services/sync.service'
import { formatRaceDate } from '@/utils/date'

export const metadata: Metadata = { title: 'Sincronización' }

/**
 * Disparo manual e historial del sincronizador.
 *
 * El disparo es asíncrono por diseño (§3.2): lanza el `workflow_dispatch` y
 * devuelve el control. Esperar al sincronizador desde una función serverless
 * daría timeout con un `backfill`, así que el progreso se observa en
 * `sync_runs` — que es la razón de que esa tabla exista.
 */
export default async function AdminSyncPage() {
  const runs = await getSyncRuns(30)
  const configurado = puedeDispararSync()

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-8">
      <header>
        <h1 className="text-lg font-bold text-white">Sincronización</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Últimas {runs.length} ejecuciones registradas en <code>sync_runs</code>.
        </p>
      </header>

      {configurado ? (
        <SyncTrigger />
      ) : (
        <p className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400">
          Faltan <code>GITHUB_SYNC_TOKEN</code> y <code>GITHUB_SYNC_REPO</code> en el
          entorno, así que no se puede lanzar desde aquí. Mientras tanto, los trabajos se
          disparan desde la pestaña Actions del repositorio.
        </p>
      )}

      {runs.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-400">
          Todavía no hay ninguna ejecución registrada.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map((run) => (
            <li
              key={run.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm text-zinc-200">{run.job}</span>
                <EstadoBadge estado={run.state} />
              </div>

              <p className="mt-1 text-xs text-zinc-500">
                {formatRaceDate(run.started_at)}
                {run.finished_at && ` · ${duracion(run)}`}
                {run.triggered_by ? ' · manual' : ' · automática'}
              </p>

              <Estadisticas stats={run.stats} />

              {run.error && (
                <p className="mt-2 rounded-lg bg-red-950/40 px-3 py-2 font-mono text-xs break-words text-red-300">
                  {run.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

const COLORES: Record<SyncRun['state'], string> = {
  success: 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300',
  running: 'border-sky-900/60 bg-sky-950/40 text-sky-300',
  partial: 'border-amber-900/60 bg-amber-950/40 text-amber-300',
  failed: 'border-red-900/60 bg-red-950/40 text-red-300',
}

function EstadoBadge({ estado }: { estado: SyncRun['state'] }) {
  return (
    <span
      className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${COLORES[estado]}`}
    >
      {estado}
    </span>
  )
}

function duracion(run: SyncRun): string {
  if (!run.finished_at) return ''
  const ms = new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()
  if (ms < 1000) return `${ms} ms`
  const segundos = Math.round(ms / 1000)
  return segundos < 60 ? `${segundos} s` : `${Math.floor(segundos / 60)} min`
}

/**
 * `stats` es un JSONB libre que rellena cada job con lo que le parece
 * relevante (`{"events":22,"riders":44}`). Se pinta tal cual en vez de mapear
 * claves conocidas: si un job añade una métrica nueva, aparece sola.
 */
function Estadisticas({ stats }: { stats: SyncRun['stats'] }) {
  if (typeof stats !== 'object' || stats === null || Array.isArray(stats)) return null

  const entradas = Object.entries(stats)
  if (entradas.length === 0) return null

  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {entradas.map(([clave, valor]) => (
        <li key={clave} className="text-xs text-zinc-400">
          <span className="text-zinc-600">{clave}</span> {String(valor)}
        </li>
      ))}
    </ul>
  )
}
