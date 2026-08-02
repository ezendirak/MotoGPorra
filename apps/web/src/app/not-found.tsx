import Link from 'next/link'

/**
 * 404.
 *
 * Se ve tanto cuando la URL no existe como cuando un Server Component llama a
 * `notFound()` — que es lo que hace el guardia de `/admin` con quien no es
 * administrador: para él, el panel sencillamente no existe, en vez de un "no
 * tienes permiso" que confirmaría que hay algo detrás.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="text-4xl" aria-hidden="true">
        🏴
      </span>
      <h1 className="text-xl font-bold text-white">Esta vuelta no existe</h1>
      <p className="text-sm text-balance text-zinc-400">
        La página que buscas no está aquí.
      </p>
      <Link
        href="/"
        className="mt-2 flex h-12 items-center justify-center rounded-xl bg-red-600 px-6 font-semibold text-white transition-colors hover:bg-red-500"
      >
        Volver al inicio
      </Link>
    </main>
  )
}
