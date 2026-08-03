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
 * Tiempo restante: "3 d 5 h", "5 h 12 min", "12 min 34 s".
 *
 * Devuelve `null` si ya pasó, para que quien lo use decida qué mostrar en vez
 * de recibir un "hace 2 días" que aquí no significa nada.
 *
 * La granularidad cambia con lo que queda porque cambia lo que le importa al
 * usuario: a tres días vista da igual el minuto exacto, y a doce minutos del
 * cierre lo único que quiere saber es si le da tiempo a apostar.
 *
 * Que por encima de la hora solo cambie cada minuto tiene además una ventaja
 * práctica: la cuenta atrás en vivo guarda el texto ya formateado, así que
 * mientras el texto no cambie React no vuelve a renderizar aunque el reloj siga
 * corriendo.
 */
export function timeUntilPrecise(
  iso: string | null,
  from: Date = new Date(),
): string | null {
  if (!iso) return null

  const ms = new Date(iso).getTime() - from.getTime()
  if (ms <= 0) return null

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
