'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Alert } from '@/components/ui/alert'
import { runSync } from '@/lib/admin/actions'
import { idleState } from '@/types/api'

/**
 * Lanza una sincronización a mano.
 *
 * Los trabajos se describen en vez de listar solo su nombre: `backfill` y `all`
 * son mucho más caros que `results`, y quien entra aquí un domingo porque una
 * carrera no aparece puntuada necesita saber cuál pulsar sin abrir el diario
 * del proyecto.
 */
const TRABAJOS = [
  {
    valor: 'results',
    etiqueta: 'Resultados',
    ayuda: 'Lo normal: importa las carreras ya corridas',
  },
  {
    valor: 'calendar',
    etiqueta: 'Calendario',
    ayuda: 'Eventos, sesiones y horarios de cierre',
  },
  { valor: 'riders', etiqueta: 'Pilotos', ayuda: 'Parrilla, equipos y dorsales' },
  {
    valor: 'all',
    etiqueta: 'Todo',
    ayuda: 'Pilotos, calendario y resultados, en ese orden',
  },
  {
    valor: 'backfill',
    etiqueta: 'Reimportar temporada',
    ayuda: '~44 peticiones a MotoGP. Solo tras una sanción',
  },
] as const

export function SyncTrigger() {
  const [state, formAction] = useActionState(runSync, idleState)

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="job" className="text-xs text-zinc-500">
          Trabajo
        </label>
        <select
          id="job"
          name="job"
          defaultValue="results"
          className="h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 focus:border-red-500 focus:outline-none"
        >
          {TRABAJOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta} — {t.ayuda}
            </option>
          ))}
        </select>
      </div>

      <BotonLanzar />

      <Alert state={state} />
    </form>
  )
}

/**
 * Separado para poder usar `useFormStatus`, que solo lee el estado del `<form>`
 * desde un hijo. Deshabilitar mientras vuela es la defensa real contra el doble
 * clic: la comprobación del servidor no puede verlo, porque el job tarda medio
 * minuto en registrarse en `sync_runs`.
 */
function BotonLanzar() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-lg bg-red-600 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Lanzando…' : 'Lanzar sincronización'}
    </button>
  )
}
