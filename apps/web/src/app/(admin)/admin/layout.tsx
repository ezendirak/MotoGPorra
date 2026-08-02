import { AdminBackLink } from '@/components/admin/back-link'
import { requireAdmin } from '@/lib/auth/session'

/**
 * Área de administración.
 *
 * `requireAdmin()` responde **404 y no 403** a quien no lo es: un 403 confirma
 * que el panel existe, y no hay ninguna razón para contarlo. Igual que en el
 * área de jugador, esto es experiencia de usuario — quien manda es la RLS, que
 * devolvería cero filas aunque alguien llamara a la API por su cuenta.
 *
 * Sin navegación inferior a propósito: el panel no es un destino habitual, se
 * entra desde el perfil y se sale con el enlace de vuelta.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/60">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-5 py-4">
          <AdminBackLink />
          <span className="text-sm font-semibold text-white">Administración</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 pb-10">{children}</div>
    </div>
  )
}
