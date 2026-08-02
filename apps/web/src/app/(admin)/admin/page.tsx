import type { Metadata } from 'next'
import Link from 'next/link'

import { getRacesWithOverride, getSyncRuns, getUsers } from '@/services/admin.service'

export const metadata: Metadata = { title: 'Administración' }

/**
 * Portada del panel.
 *
 * Enseña tres números y tres puertas. La idea es que de un vistazo se sepa si
 * hay algo que atender —una sincronización fallida, sobre todo— sin entrar en
 * cada sección.
 */
export default async function AdminPage() {
  const [runs, users, calendario] = await Promise.all([
    getSyncRuns(5),
    getUsers(),
    getRacesWithOverride(),
  ])

  const ultima = runs[0]
  const falladas = runs.filter(
    (r) => r.state === 'failed' || r.state === 'partial',
  ).length
  const forzadas = calendario.filter((c) => c.statusOverride !== null).length

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 pt-8">
      {falladas > 0 && (
        <p className="rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          {falladas === 1
            ? 'La última sincronización no terminó bien.'
            : `${falladas} sincronizaciones recientes no terminaron bien.`}
        </p>
      )}

      <dl className="grid grid-cols-3 gap-3">
        <Dato etiqueta="Participantes" valor={users.length} />
        <Dato etiqueta="Carreras" valor={calendario.length} />
        <Dato etiqueta="Forzadas" valor={forzadas} />
      </dl>

      <nav className="flex flex-col gap-2">
        <Seccion
          href="/admin/races"
          titulo="Carreras"
          descripcion="Abrir o cerrar apuestas excepcionalmente"
        />
        <Seccion
          href="/admin/users"
          titulo="Participantes"
          descripcion="Ver quién juega y quién administra"
        />
        <Seccion
          href="/admin/sync"
          titulo="Sincronización"
          descripcion={
            ultima
              ? `Última: ${ultima.job} · ${ultima.state}`
              : 'Sin ejecuciones registradas'
          }
        />
      </nav>
    </main>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-3 text-center">
      <dt className="text-xs text-zinc-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-xl font-bold text-white">{valor}</dd>
    </div>
  )
}

function Seccion({
  href,
  titulo,
  descripcion,
}: {
  href: string
  titulo: string
  descripcion: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4 transition-colors hover:border-zinc-700"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{titulo}</p>
        <p className="truncate text-xs text-zinc-500">{descripcion}</p>
      </div>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0 text-zinc-600"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  )
}
