import Link from 'next/link'
import type { Metadata } from 'next'

import { getUser } from '@/lib/auth/session'

import { ResetPasswordForm } from './reset-password-form'

export const metadata: Metadata = { title: 'Nueva contraseña · MotoGPorra' }

export default async function ResetPasswordPage() {
  // Se llega aquí desde /auth/callback, que ya canjeó el código por una
  // sesión. Sin sesión, el enlace ha caducado o se ha abierto suelto.
  const user = await getUser()

  if (!user) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-white">Enlace no válido</h1>
        <p className="text-sm text-zinc-400">
          El enlace ha caducado o ya se ha utilizado. Solicita uno nuevo.
        </p>
        <Link
          href="/forgot-password"
          className="flex h-12 items-center justify-center rounded-xl bg-red-600 text-base font-semibold text-white hover:bg-red-500"
        >
          Solicitar otro enlace
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Nueva contraseña</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Elige una contraseña nueva para tu cuenta.
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  )
}
