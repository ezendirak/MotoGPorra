/**
 * Formato de fechas. Funciones puras, sin dependencias del proyecto.
 *
 * Todas las fechas llegan de la base en UTC y se muestran en la zona horaria
 * del navegador: el usuario quiere saber a qué hora empieza la carrera *para
 * él*, no en Tailandia.
 */

const LOCALE = 'es-ES'

export function formatRaceDate(iso: string | null): string {
  if (!iso) return 'Por confirmar'
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso))
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * Tiempo restante en formato compacto: "3 d 5 h", "5 h 12 min", "8 min".
 *
 * Devuelve null si ya pasó, para que quien lo use decida qué mostrar en vez
 * de recibir un "hace 2 días" que aquí no significa nada.
 */
export function timeUntil(iso: string | null, from: Date = new Date()): string | null {
  if (!iso) return null

  const ms = new Date(iso).getTime() - from.getTime()
  if (ms <= 0) return null

  const minutos = Math.floor(ms / 60_000)
  const horas = Math.floor(minutos / 60)
  const dias = Math.floor(horas / 24)

  if (dias > 0) return `${dias} d ${horas % 24} h`
  if (horas > 0) return `${horas} h ${minutos % 60} min`
  return `${minutos} min`
}

/** Emoji de bandera a partir del código ISO de dos letras. */
export function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '🏁'
  const base = 0x1f1e6
  const [a, b] = code.toUpperCase()
  if (!a || !b) return '🏁'
  return (
    String.fromCodePoint(base + a.charCodeAt(0) - 65) +
    String.fromCodePoint(base + b.charCodeAt(0) - 65)
  )
}
