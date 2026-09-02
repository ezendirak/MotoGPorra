import Link from 'next/link'

import type { RaceView } from '@/services/races.service'
import { countryFlag, formatShortDate, formatTime } from '@/utils/date'

import { RaceStatusBadge } from './race-status-badge'

/**
 * Fila del calendario.
 *
 * Toda la tarjeta es el enlace, no un «ver más» al final: un objetivo táctil
 * de 72 px de alto se acierta sin mirar, un enlace de texto no.
 */
export function RaceCard({ race }: { race: RaceView }) {
  return (
    <Link
      href={`/races/${race.id}`}
      className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 transition-colors hover:border-zinc-700 active:bg-zinc-900"
    >
      <span className="text-2xl" aria-hidden="true">
        {countryFlag(race.country_code)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-zinc-500">
            Ronda {race.round}
          </span>
          <RaceStatusBadge status={race.status} />
        </div>
        <p className="truncate text-sm font-medium text-zinc-100">
          {race.circuit_name ?? race.event_name}
        </p>
        <p className="truncate text-xs text-zinc-500">{race.circuit_country}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-medium text-zinc-300">
          {formatShortDate(race.scheduled_at)}
        </p>
        <p className="text-xs text-zinc-500">{formatTime(race.scheduled_at)}</p>
      </div>
    </Link>
  )
}
