'use client'

/**
 * Error boundary de toda la app.
 *
 * En producción Next.js **no** manda el mensaje original al cliente para no
 * filtrar detalles del servidor: lo único que llega es `digest`, un hash con el
 * que localizar la traza real en los logs. Por eso se muestra: sin él, un fallo
 * reportado por un participante es imposible de rastrear.
 *
 * ⚠️ Next.js 16 renombra el prop de reintento: era `reset` y ahora es
 * `unstable_retry`. Reintentar vuelve a renderizar el segmento en servidor, que
 * es justo lo que hace falta cuando el fallo ha sido una consulta que expiró.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="text-4xl" aria-hidden="true">
        🟡
      </span>
      <h1 className="text-xl font-bold text-white">Coche parado en pista</h1>
      <p className="text-sm text-balance text-zinc-400">
        Algo ha fallado por nuestro lado. Tu apuesta no se ha perdido.
      </p>

      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-2 flex h-12 items-center justify-center rounded-xl bg-red-600 px-6 font-semibold text-white transition-colors hover:bg-red-500"
      >
        Reintentar
      </button>

      {error.digest && (
        <p className="mt-2 font-mono text-xs text-zinc-600">Referencia: {error.digest}</p>
      )}
    </main>
  )
}
