'use client'

import { useEffect, useState } from 'react'

import { RiderAvatar, RiderNumber } from '@/components/riders/rider-avatar'
import type { SeasonRider } from '@/services/riders.service'

const MEDALLAS = ['🥇', '🥈', '🥉'] as const

/**
 * Selector de piloto en hoja inferior.
 *
 * Hoja inferior y no modal centrado: en un móvil la lista queda al alcance del
 * pulgar y el gesto de cerrar (deslizar hacia abajo o tocar fuera) es el que
 * la gente ya espera.
 *
 * **Aparecen todos, siempre.** Antes los ya elegidos salían deshabilitados, y
 * corregirse —poner en 1º a quien habías puesto 3º— obligaba a quitarlo de su
 * sitio y volver a buscarlo. Ahora elegir a uno que ya ocupa otra posición las
 * intercambia, y su medalla actual se pinta a la derecha para que se vea venir
 * antes de tocar nada.
 */
export function RiderPicker({
  open,
  riders,
  picks,
  indice,
  onSelect,
  onClose,
  title,
}: {
  open: boolean
  riders: SeasonRider[]
  /** El podio tal y como está ahora, para saber quién ocupa qué. */
  picks: (string | null)[]
  /** Posición que se está eligiendo, o `null` si la hoja está cerrada. */
  indice: number | null
  onSelect: (riderId: string) => void
  onClose: () => void
  title: string
}) {
  // El buscador arranca vacío en cada apertura porque el padre remonta este
  // componente con `key`. Resetearlo desde un efecto dispararía un render en
  // cascada, que es justo lo que avisa la regla de ESLint.
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Evita que el fondo se desplace mientras la hoja está abierta.
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const filtrados = query
    ? riders.filter(
        (r) =>
          normalizar(r.fullName).includes(normalizar(query)) ||
          String(r.number ?? '').includes(query),
      )
    : riders

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative mx-auto flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-2xl border-t border-zinc-800 bg-zinc-950 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex flex-col gap-3 border-b border-zinc-800 px-5 pt-3 pb-4">
          <div className="mx-auto h-1 w-10 rounded-full bg-zinc-700" aria-hidden="true" />
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar piloto o dorsal"
            className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-base text-zinc-100 placeholder:text-zinc-500 focus:ring-2 focus:ring-red-500/60 focus:outline-none"
          />
        </div>

        <ul className="flex-1 overflow-y-auto overscroll-contain p-2">
          {filtrados.map((rider) => {
            const ocupa = picks.indexOf(rider.riderId)
            const elegido = ocupa === indice && ocupa !== -1
            // Ocupa OTRA posición: elegirlo aquí las intercambiará.
            const intercambia = ocupa !== -1 && ocupa !== indice

            return (
              <li key={rider.riderId}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(rider.riderId)
                    onClose()
                  }}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                    'hover:bg-zinc-900 active:bg-zinc-800',
                    elegido ? 'bg-red-600/15 ring-1 ring-red-600/50' : '',
                  ].join(' ')}
                >
                  <RiderAvatar
                    headshotUrl={rider.headshotUrl}
                    number={rider.number}
                    teamColor={rider.teamColor}
                    size={44}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-100">
                      {rider.fullName}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {rider.team ?? 'Sin equipo'}
                    </span>
                  </span>
                  {intercambia ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-400">
                      <span aria-hidden="true">{MEDALLAS[ocupa]}</span>
                      <span>Intercambiar</span>
                    </span>
                  ) : (
                    <RiderNumber
                      numberImageUrl={rider.numberImageUrl}
                      number={rider.number}
                      height={22}
                      className="shrink-0"
                    />
                  )}
                </button>
              </li>
            )
          })}

          {filtrados.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-zinc-500">
              Ningún piloto coincide con «{query}»
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
