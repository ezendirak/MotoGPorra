import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { RaceStatusBadge } from '@/components/races/race-status-badge'
import { getMyBet, getRaceBets } from '@/services/bets.service'
import { getRaceById, getRaceResult } from '@/services/races.service'
import { RaceCountdown } from '@/components/races/race-countdown'
import { countryFlag, formatRaceDate, timeUntilPrecise } from '@/utils/date'

export const metadata: Metadata = { title: 'Carrera' }

const MEDALLAS = ['🥇', '🥈', '🥉'] as const

export default async function RaceDetailPage({
  params,
}: {
  params: Promise<{ raceId: string }>
}) {
  const { raceId } = await params
  const race = await getRaceById(raceId)
  if (!race) notFound()

  const [resultado, apuestas, miApuesta] = await Promise.all([
    getRaceResult(raceId),
    getRaceBets(raceId),
    getMyBet(raceId),
  ])

  const podio = resultado.filter((e) => e.position !== null && e.position <= 3)
  const podioIds = podio.map((e) => e.riders?.id)
  const abierta = race.status === 'open'
  const restante = timeUntilPrecise(race.closes_at)

  return (
    <main className="flex flex-col gap-6 px-5 pt-8">
      <header className="flex flex-col gap-3">
        <Link href="/races" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Carreras
        </Link>

        <div className="flex items-start gap-3">
          <span className="text-4xl" aria-hidden="true">
            {countryFlag(race.country_code)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">
                R{race.round} · {race.kind === 'sprint' ? 'Sprint' : 'Carrera'}
              </span>
              <RaceStatusBadge status={race.status} />
            </div>
            <h1 className="mt-1 text-xl leading-tight font-bold text-white">
              {race.circuit_name}
            </h1>
            <p className="text-sm text-zinc-400">
              {race.circuit_city}, {race.circuit_country}
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-500">{formatRaceDate(race.scheduled_at)}</p>
      </header>

      {abierta && (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-semibold text-zinc-200">Tu apuesta</h2>

          {miApuesta ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {miApuesta.picks.map((pick, i) => (
                <li key={pick.position} className="flex items-center gap-2 text-sm">
                  <span aria-hidden="true">{MEDALLAS[i]}</span>
                  <span className="text-zinc-200">{pick.riderName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">Aún no has apostado.</p>
          )}

          <p className="mt-3 text-xs text-zinc-500">
            <RaceCountdown
              closesAt={race.closes_at}
              inicial={restante}
              prefijo="Cierra "
              textoCerrado="A punto de cerrarse"
              className="tabular-nums"
            />
          </p>

          <Link
            href={`/races/${raceId}/bet`}
            className="mt-4 flex h-12 items-center justify-center rounded-xl bg-red-600 font-semibold text-white transition-colors hover:bg-red-500"
          >
            {miApuesta ? 'Cambiar apuesta' : 'Apostar'}
          </Link>
        </section>
      )}

      {podio.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Podio oficial</h2>
          <ul className="flex flex-col gap-2">
            {podio.map((entry, i) => (
              <li
                key={entry.riders?.id ?? i}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <span className="text-xl" aria-hidden="true">
                  {MEDALLAS[i]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {entry.riders?.full_name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{entry.team_name}</p>
                </div>
                <span className="shrink-0 font-mono text-xs text-zinc-400">
                  {i === 0 ? entry.total_time : `+${entry.gap_to_first}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        Las apuestas ajenas solo llegan aquí cuando la carrera está cerrada:
        la política RLS `bets_select_others_after_close` las filtra antes. Si
        la lista viene con una sola entrada mientras está abierta, es la propia.
      */}
      {!abierta && apuestas.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">
            Apuestas ({apuestas.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {apuestas.map((bet) => (
              <li
                key={bet.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <p className="text-sm font-medium text-zinc-200">{bet.displayName}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {bet.picks.map((pick, i) => {
                    const acertado = podioIds[i] === pick.riderId
                    return (
                      <li key={pick.position} className="flex items-center gap-2 text-xs">
                        <span aria-hidden="true">{MEDALLAS[i]}</span>
                        <span className={acertado ? 'text-emerald-400' : 'text-zinc-400'}>
                          {pick.riderName}
                        </span>
                        {podio.length > 0 && (
                          <span aria-label={acertado ? 'acierto' : 'fallo'}>
                            {acertado ? '✅' : '❌'}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resultado.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">
            Clasificación completa
          </h2>
          <ol className="flex flex-col divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/40">
            {resultado.map((entry, i) => (
              <li
                key={entry.riders?.id ?? i}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="w-6 shrink-0 text-right font-mono text-xs text-zinc-500">
                  {entry.position ?? '—'}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate ${
                    entry.is_classified ? 'text-zinc-200' : 'text-zinc-600 line-through'
                  }`}
                >
                  {entry.riders?.full_name}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {entry.championship_points ? `${entry.championship_points} pts` : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  )
}
