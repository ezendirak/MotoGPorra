import Link from 'next/link'

/**
 * Envoltorio de las pantallas sin sesión.
 *
 * Mobile First: el contenido se ancla abajo (`justify-end`) para que los
 * campos y el botón queden al alcance del pulgar en un móvil, y solo se
 * centra a partir de pantallas medianas.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col justify-end bg-zinc-950 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:justify-center">
      <div className="mx-auto w-full max-w-sm">
        <header className="mb-8">
          <Link href="/login" className="inline-flex items-baseline gap-1">
            <span className="text-2xl font-black tracking-tight text-white">MotoG</span>
            <span className="text-2xl font-black tracking-tight text-red-600">Porra</span>
          </Link>
          <p className="mt-2 text-sm text-zinc-400">La porra del Mundial de MotoGP</p>
        </header>

        {children}
      </div>
    </div>
  )
}
