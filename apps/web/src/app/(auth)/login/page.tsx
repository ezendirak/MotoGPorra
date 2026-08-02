import Link from 'next/link'
import type { Metadata } from 'next'

import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Entrar · MotoGPorra' }

const ERRORS: Record<string, string> = {
  enlace_invalido: 'El enlace no es válido. Solicita uno nuevo.',
  enlace_caducado: 'El enlace ha caducado. Solicita uno nuevo.',
}

export default async function LoginPage({
  searchParams,
}: {
  // En Next.js 16 `searchParams` es una promesa: el acceso síncrono se eliminó.
  searchParams: Promise<{ redirectTo?: string; error?: string }>
}) {
  const { redirectTo, error } = await searchParams

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Entrar</h1>

      {error && ERRORS[error] && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {ERRORS[error]}
        </div>
      )}

      <LoginForm redirectTo={redirectTo} />

      <div className="flex flex-col gap-3 text-center text-sm">
        <Link href="/forgot-password" className="text-zinc-400 hover:text-zinc-200">
          ¿Has olvidado la contraseña?
        </Link>
        <p className="text-zinc-500">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="font-medium text-red-500 hover:text-red-400">
            Crear una
          </Link>
        </p>
      </div>
    </div>
  )
}
