'use client'

import { useActionState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Field } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { forgotPassword } from '@/lib/auth/actions'
import { idleState } from '@/types/api'

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPassword, idleState)
  const errors = state.status === 'error' ? state.fieldErrors : undefined

  if (state.status === 'success') {
    return <Alert state={state} />
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Alert state={state} />

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

      <SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton>
    </form>
  )
}
