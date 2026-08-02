import type { RaceStatus } from '@/services/races.service'

const ESTILOS: Record<RaceStatus, { texto: string; clase: string }> = {
  open: {
    texto: 'Abierta',
    clase: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  },
  closed: {
    texto: 'Cerrada',
    clase: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  },
  finished: {
    texto: 'Finalizada',
    clase: 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
  },
  upcoming: {
    texto: 'Próxima',
    clase: 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
  },
  cancelled: {
    texto: 'Cancelada',
    clase: 'border-red-500/40 bg-red-500/10 text-red-400',
  },
}

export function RaceStatusBadge({ status }: { status: RaceStatus | null }) {
  const estilo = status ? ESTILOS[status] : null
  if (!estilo) return null

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${estilo.clase}`}
    >
      {estilo.texto}
    </span>
  )
}
