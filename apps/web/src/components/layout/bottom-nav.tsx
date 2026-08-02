'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Navegación inferior.
 *
 * Abajo y no arriba porque es donde llega el pulgar con el móvil en una mano.
 * Cuatro destinos: más iconos obligan a apuntar y menos no cubren la app.
 * Cada objetivo mide 64×56 px, holgadamente por encima del mínimo de 44 px.
 */
const DESTINOS = [
  { href: '/', label: 'Inicio', icon: HomeIcon },
  { href: '/races', label: 'Carreras', icon: FlagIcon },
  { href: '/standings', label: 'Clasificación', icon: TrophyIcon },
  { href: '/profile', label: 'Perfil', icon: UserIcon },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md">
        {DESTINOS.map(({ href, label, icon: Icon }) => {
          // `/races/algo` mantiene activo «Carreras»; `/` solo cuando es exacto.
          const activo = href === '/' ? pathname === '/' : pathname.startsWith(href)

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activo ? 'page' : undefined}
                className={[
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors',
                  activo ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

const props = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function HomeIcon() {
  return (
    <svg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}

function FlagIcon() {
  return (
    <svg {...props}>
      <path d="M4 21V4" />
      <path d="M4 4h9l-1 3 8 0v9h-8l1-3H4" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg {...props}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
      <path d="M10 14h4M9 20h6M12 14v6" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}
