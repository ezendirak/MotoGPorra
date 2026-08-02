import { getProfile } from '@/lib/auth/session'
import { logout } from '@/lib/auth/actions'

/**
 * Home provisional.
 *
 * En la fase 3 pasará a mostrar la próxima carrera con su cuenta atrás y la
 * posición del usuario en la clasificación. De momento sirve para comprobar
 * de un vistazo que la sesión y el perfil funcionan.
 */
export default async function HomePage() {
  const profile = await getProfile()

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 pt-10">
      <div>
        <p className="text-sm text-zinc-400">Hola,</p>
        <h1 className="text-2xl font-bold text-white">
          {profile?.display_name ?? 'piloto'}
        </h1>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <p className="text-sm text-zinc-400">
          La temporada aún no tiene carreras cargadas. Llegarán automáticamente desde la
          sincronización con MotoGP.
        </p>
      </div>

      <form action={logout} className="mt-auto">
        <button
          type="submit"
          className="h-12 w-full rounded-xl border border-zinc-800 text-sm font-medium text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  )
}
