'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Enlace de vuelta del panel, que sabe dónde está.
 *
 * Desde una sección se vuelve a `/admin`, y desde la portada del panel se sale
 * a `/profile`, que es por donde se entró. Antes iba fijo a `/`, así que desde
 * cualquier sección se salía de la administración de un salto y había que
 * volver a entrar por el perfil para ir a otra.
 *
 * Es un `<Link>` con destino real y no un `router.back()`: el historial puede
 * traer al usuario desde cualquier sitio —una recarga, un enlace compartido— y
 * «atrás» dejaría de significar «un nivel arriba». Aquí la jerarquía es fija y
 * conviene que el botón la refleje.
 */
export function AdminBackLink() {
  const pathname = usePathname()

  const enPortada = pathname === '/admin'
  const href = enPortada ? '/profile' : '/admin'
  const etiqueta = enPortada ? 'Volver al perfil' : 'Volver al panel'

  return (
    <Link
      href={href}
      aria-label={etiqueta}
      className="-m-2 flex h-10 w-10 items-center justify-center text-zinc-400 transition-colors hover:text-zinc-200"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  )
}
