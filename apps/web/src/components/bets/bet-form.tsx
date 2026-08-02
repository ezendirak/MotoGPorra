'use client'

import { useActionState, useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { SubmitButton } from '@/components/ui/submit-button'
import { placeBet } from '@/lib/bets/actions'
import type { SeasonRider } from '@/services/riders.service'
import { idleState } from '@/types/api'

import { RiderPicker } from './rider-picker'

const MEDALLAS = ['🥇', '🥈', '🥉'] as const
const ORDINALES = ['Primero', 'Segundo', 'Tercero'] as const

export function BetForm({
  raceId,
  riders,
  initialPicks,
}: {
  raceId: string
  riders: SeasonRider[]
  initialPicks: string[]
}) {
  const [state, formAction] = useActionState(placeBet, idleState)
  const [picks, setPicks] = useState<(string | null)[]>([
    initialPicks[0] ?? null,
    initialPicks[1] ?? null,
    initialPicks[2] ?? null,
  ])
  const [abierto, setAbierto] = useState<number | null>(null)

  const porId = new Map(riders.map((r) => [r.riderId, r]))
  const completa = picks.every((p) => p !== null)

  const elegir = (indice: number, riderId: string) => {
    setPicks((actual) => actual.map((p, i) => (i === indice ? riderId : p)))
  }

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        <Alert state={state} />

        <input type="hidden" name="raceId" value={raceId} />
        {picks.map((pick, i) => (
          <input key={i} type="hidden" name={`rider${i + 1}`} value={pick ?? ''} />
        ))}

        <ul className="flex flex-col gap-3">
          {picks.map((pick, i) => {
            const rider = pick ? porId.get(pick) : null

            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setAbierto(i)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 text-left transition-colors hover:border-zinc-700 active:bg-zinc-900"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {MEDALLAS[i]}
                  </span>

                  {rider ? (
                    <>
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-zinc-950"
                        style={{ backgroundColor: rider.teamColor ?? '#a1a1aa' }}
                        aria-hidden="true"
                      >
                        {rider.number ?? '—'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-zinc-100">
                          {rider.fullName}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {rider.team ?? 'Sin equipo'}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className="flex-1 text-sm text-zinc-500">
                      {ORDINALES[i]} clasificado
                    </span>
                  )}

                  <span className="shrink-0 text-xs font-medium text-red-500">
                    {rider ? 'Cambiar' : 'Elegir'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <SubmitButton pendingText="Guardando…">
          {completa ? 'Guardar apuesta' : 'Elige los tres pilotos'}
        </SubmitButton>

        {!completa && (
          <p className="text-center text-xs text-zinc-500">
            Puedes cambiarla las veces que quieras hasta el cierre.
          </p>
        )}
      </form>

      <RiderPicker
        // Remontar en cada apertura deja el buscador vacío sin necesidad de
        // resetearlo desde un efecto.
        key={abierto ?? 'cerrado'}
        open={abierto !== null}
        riders={riders}
        // Los ya elegidos en OTRA posición se bloquean: la base rechazaría la
        // apuesta con DUPLICATE_RIDER, y es mejor impedirlo que explicarlo.
        disabledIds={picks.filter((p, i): p is string => p !== null && i !== abierto)}
        selectedId={abierto !== null ? (picks[abierto] ?? null) : null}
        onSelect={(riderId) => {
          if (abierto !== null) elegir(abierto, riderId)
        }}
        onClose={() => setAbierto(null)}
        title={abierto !== null ? `${ORDINALES[abierto]} clasificado` : ''}
      />
    </>
  )
}
