import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sin conexión',
}

/**
 * Página que el service worker sirve cuando una navegación no llega a la red.
 *
 * Es deliberadamente estática y no llama a `requireUser()`: se precarga en el
 * `install` del worker, mucho antes de que exista sesión, y tiene que poder
 * renderizarse desde el caché sin servidor detrás. Por eso vive fuera del
 * grupo `(app)` y está en las rutas públicas del proxy.
 *
 * No ofrece un botón de "reintentar" con `location.reload()` porque eso
 * obligaría a un Client Component para algo que el botón de recarga del
 * navegador ya hace: el enlace a la home basta, y en cuanto vuelve la red la
 * navegación pasa de largo por el worker.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="text-4xl" aria-hidden="true">
        🏁
      </span>
      <h1 className="text-xl font-bold text-white">Bandera roja</h1>
      <p className="text-sm text-balance text-zinc-400">
        No hay conexión, así que no podemos traer las carreras ni tu apuesta. Se recupera
        solo en cuanto vuelva la red.
      </p>
      {/*
        `<a>` y no `<Link>` a propósito: `<Link>` navega por el cliente y pide
        la carga RSC de la home, que sin red vuelve a fallar y deja al usuario
        en la misma pantalla. Una navegación completa reintenta el documento
        entero, que es justo lo que se está pidiendo aquí.
      */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="mt-2 flex h-12 items-center justify-center rounded-xl bg-red-600 px-6 font-semibold text-white transition-colors hover:bg-red-500"
      >
        Volver a intentarlo
      </a>
    </main>
  )
}
