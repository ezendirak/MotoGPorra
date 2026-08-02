import { requireUser } from '@/lib/auth/session'

/**
 * Área con sesión.
 *
 * El `requireUser()` es la segunda barrera: el proxy ya redirige a quien no
 * tiene sesión, pero el proxy hace una comprobación optimista y la propia
 * documentación de Next.js desaconseja confiarle la autorización. Aquí se
 * valida en el servidor, y por debajo sigue estando la RLS de la base de
 * datos, que es la que de verdad no se puede esquivar.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser()

  return (
    <div className="flex min-h-dvh flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}
