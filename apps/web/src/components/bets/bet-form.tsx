'use client'

import { useActionState, useState } from 'react'

import { RiderAvatar, RiderNumber } from '@/components/riders/rider-avatar'
import { Alert } from '@/components/ui/alert'
import { SubmitButton } from '@/components/ui/submit-button'
import { placeBet } from '@/lib/bets/actions'
import type { SeasonRider } from '@/services/riders.service'
import { idleState } from '@/types/api'
import { colocarPiloto } from '@/utils/podium'

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

  /**
   * Coloca un piloto en una posición. Si ya estaba en OTRA, las intercambia.
   *
   * Antes los ya elegidos salían deshabilitados, y mover a alguien del 3º al 1º
   * obligaba a quitarlo primero y buscarlo otra vez. El intercambio resuelve
   * ese caso en un gesto y no deja huecos: reordenar el podio es lo que más se
   * hace, y es justo lo que peor funcionaba.
   *
   * Cuando la posición de destino está vacía, intercambiar equivale a mover y
   * dejar libre la de origen — que es el otro caso que la gente esperaba.
   */
  const elegir = (indice: number, riderId: string) => {
    setPicks((actual) => colocarPiloto(actual, indice, riderId))
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
                      <RiderAvatar
                        headshotUrl={rider.headshotUrl}
                        number={rider.number}
                        teamColor={rider.teamColor}
                        size={56}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-zinc-100">
                          {rider.fullName}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {rider.team ?? 'Sin equipo'}
                        </span>
                      </span>
                      <RiderNumber
                        numberImageUrl={rider.numberImageUrl}
                        number={rider.number}
                        height={26}
                        className="shrink-0"
                      />
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
        // La lista entera, siempre. Ya no se bloquea a nadie: elegir a alguien
        // que ya ocupa otra posición las intercambia, y el selector lo avisa
        // antes de tocar nada.
        picks={picks}
        indice={abierto}
        onSelect={(riderId) => {
          if (abierto !== null) elegir(abierto, riderId)
        }}
        onClose={() => setAbierto(null)}
        title={abierto !== null ? `${ORDINALES[abierto]} clasificado` : ''}
      />
    </>
  )
}
