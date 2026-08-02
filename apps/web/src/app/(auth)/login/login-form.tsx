'use client'

import { useActionState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Field } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { login } from '@/lib/auth/actions'
import { idleState } from '@/types/api'

// `string | undefined` explícito y no `?: string`: con
// `exactOptionalPropertyTypes` activado, pasar una propiedad cuyo valor puede
// ser undefined no es lo mismo que omitirla.
export function LoginForm({ redirectTo }: { redirectTo?: string | undefined }) {
  const [state, formAction] = useActionState(login, idleState)
  const errors = state.status === 'error' ? state.fieldErrors : undefined

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Alert state={state} />

      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      <Field
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="tu@email.com"
        required
        errors={errors?.email}
      />

      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
        errors={errors?.password}
      />

      <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
    </form>
  )
}
