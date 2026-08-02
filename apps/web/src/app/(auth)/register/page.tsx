import Link from 'next/link'
import type { Metadata } from 'next'

import { RegisterForm } from './register-form'

export const metadata: Metadata = { title: 'Crear cuenta · MotoGPorra' }

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Crear cuenta</h1>

      <RegisterForm />

      <p className="text-center text-sm text-zinc-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-red-500 hover:text-red-400">
          Entrar
        </Link>
      </p>
    </div>
  )
}
