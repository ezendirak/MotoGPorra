import Link from 'next/link'
import type { Metadata } from 'next'

import { ForgotPasswordForm } from './forgot-password-form'

export const metadata: Metadata = { title: 'Recuperar contraseña · MotoGPorra' }

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Te enviaremos un enlace para elegir una nueva.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-sm">
        <Link href="/login" className="text-zinc-400 hover:text-zinc-200">
          Volver a entrar
        </Link>
      </p>
    </div>
  )
}
