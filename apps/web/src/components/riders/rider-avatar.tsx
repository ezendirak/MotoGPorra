/**
 * Retrato de un piloto sobre el color de su equipo.
 *
 * La imagen la sirve Supabase Storage, no MotoGP: el sincronizador descarga el
 * original, lo recorta y lo reescala (ver `apps/sync/.../images.py`). Aquí
 * siempre llega un WebP de 256px y unos 12 KB, así que se pinta con `<img>` y
 * no con `next/image`: optimizar lo ya optimizado solo gastaría cuota de
 * transformaciones de Vercel para devolver el mismo fichero.
 *
 * Cae en el dorsal sobre el color del equipo cuando no hay foto — que es lo
 * que se veía antes de que existieran las imágenes, y sigue siendo el aspecto
 * de un piloto recién llegado a la parrilla.
 */
export function RiderAvatar({
  headshotUrl,
  number,
  teamColor,
  size = 40,
}: {
  headshotUrl: string | null
  number: number | null
  teamColor: string | null
  size?: number
}) {
  const color = teamColor ?? '#a1a1aa'

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl"
      style={{
        width: size,
        height: size,
        // Tinte del equipo, no color plano: el recorte llega con fondo
        // transparente y sobre un color saturado el rostro pierde contraste.
        background: headshotUrl
          ? `linear-gradient(165deg, ${conAlfa(color, '4d')}, ${conAlfa(color, '14')})`
          : color,
      }}
      aria-hidden="true"
    >
      {headshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- ver cabecera
        <img
          src={headshotUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="text-sm font-bold text-zinc-950"
          style={{ fontSize: Math.round(size * 0.35) }}
        >
          {number ?? '—'}
        </span>
      )}
    </span>
  )
}

/**
 * El dorsal dibujado con la tipografía y los colores del piloto.
 *
 * No lo tienen todos: MotoGP publica el recurso a lo largo de la temporada y
 * un debutante puede no tenerlo en ninguna. Cuando falta se pinta el número a
 * secas, que ocupa lo mismo y no deja un hueco.
 */
export function RiderNumber({
  numberImageUrl,
  number,
  height = 20,
  className = '',
}: {
  numberImageUrl: string | null
  number: number | null
  height?: number
  className?: string
}) {
  if (numberImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ver cabecera
      <img
        src={numberImageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        style={{ height }}
        className={`w-auto object-contain ${className}`}
        aria-hidden="true"
      />
    )
  }

  if (number === null) return null

  return (
    <span
      className={`font-mono text-xs font-bold text-zinc-500 tabular-nums ${className}`}
      aria-hidden="true"
    >
      {number}
    </span>
  )
}

/** Añade alfa a un color `#rrggbb`; deja pasar cualquier otra cosa tal cual. */
function conAlfa(color: string, alfa: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alfa}` : color
}
