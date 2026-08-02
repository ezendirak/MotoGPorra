import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { BetForm } from '@/components/bets/bet-form'
import { getMyBet } from '@/services/bets.service'
import { getRaceById } from '@/services/races.service'
import { getSeasonRiders } from '@/services/riders.service'
import { RaceCountdown } from '@/components/races/race-countdown'
import { countryFlag, formatRaceDate, timeUntilPrecise } from '@/utils/date'

export const metadata: Metadata = { title: 'Tu apuesta' }

export default async function BetPage({
  params,
}: {
  // En Next.js 16 `params` es una promesa: el acceso síncrono se eliminó.
  params: Promise<{ raceId: string }>
}) {
  const { raceId } = await params
  const race = await getRaceById(raceId)
  if (!race) notFound()

  // La comprobación de verdad la hace `place_bet` con el reloj del servidor.
  // Esto solo evita presentar un formulario que iba a ser rechazado.
  if (race.status !== 'open') {
    return (
      <main className="flex flex-col gap-6 px-5 pt-10">
        <h1 className="text-xl font-bold text-white">Apuestas cerradas</h1>
        <p className="text-sm text-zinc-400">Ya no se puede apostar a esta carrera.</p>
        <Link
          href={`/races/${raceId}`}
          className="flex h-12 items-center justify-center rounded-xl bg-red-600 font-semibold text-white hover:bg-red-500"
        >
          Ver la carrera
        </Link>
      </main>
    )
  }

  const [riders, miApuesta] = await Promise.all([
    getSeasonRiders(race.season_id!, race.category_id!),
    getMyBet(raceId),
  ])

  const restante = timeUntilPrecise(race.closes_at)

  return (
    <main className="flex flex-col gap-6 px-5 pt-8">
      <header className="flex flex-col gap-2">
        <Link
          href={`/races/${raceId}`}
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          ← Volver
        </Link>

        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden="true">
            {countryFlag(race.country_code)}
          </span>
          <div className="min-w-0">
            <h1 className="text-lg leading-tight font-bold text-white">
              {race.circuit_name}
            </h1>
            <p className="text-sm text-zinc-400">
              {race.kind === 'sprint' ? 'Sprint' : 'Carrera'} · Ronda {race.round}
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-500">{formatRaceDate(race.scheduled_at)}</p>
      </header>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <p className="text-sm text-amber-300">
          <RaceCountdown
            closesAt={race.closes_at}
            inicial={restante}
            prefijo="Cierra "
            textoCerrado="El plazo está a punto de cerrarse"
            className="font-semibold tabular-nums"
          />
        </p>
      </div>

      <BetForm
        raceId={raceId}
        riders={riders}
        initialPicks={miApuesta?.picks.map((p) => p.riderId) ?? []}
      />
    </main>
  )
}
