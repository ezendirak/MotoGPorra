/**
 * Formato de fechas. Funciones puras, sin dependencias del proyecto.
 *
 * Las fechas llegan de la base en UTC y se muestran **siempre en hora
 * peninsular**, no en la del dispositivo.
 *
 * ⚠️ El motivo es que esto se ejecuta casi siempre en Server Components, donde
 * no hay navegador: `Intl` usa entonces la zona del proceso, que en Vercel es
 * UTC y en un portátil español es `Europe/Madrid`. Sin fijarla, la misma
 * carrera se anunciaba dos horas antes en producción que en desarrollo —y la
 * hora de la carrera es justo el dato por el que alguien pone la tele.
 *
 * Fijarla también la hace determinista: servidor y cliente pintan lo mismo, así
 * que no hay nada que hidratar mal. La contrapartida asumida es que quien mire
 * desde otro huso verá la hora de España; para una porra entre amigos de aquí
 * es incluso lo que se espera («la carrera es a las dos»).
 */

const LOCALE = 'es-ES'

/** El identificador IANA se encarga solo del salto CEST/CET. */
const ZONA = 'Europe/Madrid'

export function formatRaceDate(iso: string | null): string {
  if (!iso) return 'Por confirmar'
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: ZONA,
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
    timeZone: ZONA,
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso))
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * Milisegundos que faltan hasta `iso`, o `null` si ya pasó.
 *
 * Devuelve el NÚMERO y no el texto a propósito: lo calcula el SERVIDOR una vez
 * y el navegador descuenta desde ahí con un reloj monótono (ver
 * `useCountdown`). Aquí hubo una función que formateaba directamente
 * comparando con `new Date()`, y al usarla desde el cliente hacía que un móvil
 * con la hora atrasada anunciara plazo cuando ya no lo había.
 *
 * Por eso `from` no tiene sentido pasarlo desde un componente de cliente: si
 * acabas necesitándolo ahí, casi seguro que lo que quieres es la cuenta atrás.
 */
export function msHasta(iso: string | null, from: Date = new Date()): number | null {
  if (!iso) return null

  const ms = new Date(iso).getTime() - from.getTime()
  return ms > 0 ? ms : null
}

/** Formatea una duración en milisegundos: `3 d 5 h`, `12 min 34 s`, `45 s`. */
export function formatDuracion(ms: number): string {
  const segundos = Math.floor(ms / 1000)
  const minutos = Math.floor(segundos / 60)
  const horas = Math.floor(minutos / 60)
  const dias = Math.floor(horas / 24)

  if (dias > 0) return `${dias} d ${horas % 24} h`
  if (horas > 0) return `${horas} h ${minutos % 60} min`
  // En el último minuto sobra el "0 min": lo que queda son segundos y ya está.
  if (minutos > 0) return `${minutos} min ${segundos % 60} s`
  return `${segundos} s`
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
