'use client'

import { useActionState } from 'react'

import { Alert } from '@/components/ui/alert'
import { overrideRaceStatus } from '@/lib/admin/actions'
import { idleState } from '@/types/api'

/**
 * Fuerza el estado de una carrera, o lo devuelve al cálculo automático.
 *
 * El desplegable no lista los cinco estados posibles: solo los tres que tienen
 * sentido forzar a mano. «finished» lo pone el resultado oficial y ponerlo aquí
 * mentiría —no habría podio que enseñar—, y «upcoming» no arregla nada que no
 * arregle ya «auto».
 */
const OPCIONES = [
  { valor: 'auto', etiqueta: 'Automático (por horario)' },
  { valor: 'open', etiqueta: 'Forzar abierta' },
  { valor: 'closed', etiqueta: 'Forzar cerrada' },
  { valor: 'cancelled', etiqueta: 'Marcar cancelada' },
] as const

export function RaceStatusControl({
  raceId,
  overrideActual,
}: {
  raceId: string
  overrideActual: string | null
}) {
  const [state, formAction] = useActionState(overrideRaceStatus, idleState)

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="raceId" value={raceId} />

      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`status-${raceId}`}>
          Estado forzado
        </label>
        <select
          id={`status-${raceId}`}
          name="status"
          defaultValue={overrideActual ?? 'auto'}
          className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 focus:border-red-500 focus:outline-none"
        >
          {OPCIONES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="h-11 shrink-0 rounded-lg bg-zinc-700 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
        >
          Aplicar
        </button>
      </div>

      <Alert state={state} />
    </form>
  )
}
