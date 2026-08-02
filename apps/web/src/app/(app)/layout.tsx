import { BottomNav } from '@/components/layout/bottom-nav'
import { InstallPrompt } from '@/components/layout/install-prompt'
import { requireUser } from '@/lib/auth/session'

/**
 * Área con sesión.
 *
 * `requireUser()` es la segunda barrera: el proxy ya redirige a quien no tiene
 * sesión, pero hace una comprobación optimista y la propia documentación de
 * Next.js desaconseja confiarle la autorización. Por debajo sigue estando la
 * RLS, que es la que de verdad no se puede esquivar.
 *
 * El `pb-20` reserva el alto de la navegación inferior, que es fija: sin él,
 * el último elemento de cada lista quedaría tapado.
 *
 * La invitación a instalar cuelga de aquí y no del layout raíz a propósito:
 * pedirle a alguien que se instale la app antes siquiera de haber entrado, con
 * el formulario de login delante, es pedirlo en el peor momento posible.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser()

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-md flex-1 pb-20">{children}</div>
      <InstallPrompt />
      <BottomNav />
    </div>
  )
}
