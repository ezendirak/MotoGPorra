/**
 * Puestos ganados o perdidos desde la carrera anterior.
 *
 * Server Component: es una flecha y un número, no necesita nada del navegador.
 *
 * El color no es la única señal —la flecha apunta arriba o abajo— porque en una
 * clasificación deportiva el rojo y el verde son exactamente lo que un daltónico
 * no distingue, y aquí toda la información estaría en el color.
 */
export function PositionDelta({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span
        className="w-9 shrink-0 text-center text-xs text-zinc-700"
        title="Sin datos anteriores"
      >
        —
      </span>
    )
  }

  if (delta === 0) {
    return (
      <span
        className="w-9 shrink-0 text-center text-xs text-zinc-600"
        title="Mantiene la posición"
      >
        =
      </span>
    )
  }

  const sube = delta > 0

  return (
    <span
      className={`flex w-9 shrink-0 items-center justify-center gap-0.5 text-xs font-medium tabular-nums ${
        sube ? 'text-emerald-400' : 'text-red-400'
      }`}
      title={`${sube ? 'Sube' : 'Baja'} ${Math.abs(delta)} ${
        Math.abs(delta) === 1 ? 'puesto' : 'puestos'
      } desde la carrera anterior`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={sube ? '' : 'rotate-180'}
      >
        <path d="M12 4l8 12H4z" />
      </svg>
      {Math.abs(delta)}
    </span>
  )
}
