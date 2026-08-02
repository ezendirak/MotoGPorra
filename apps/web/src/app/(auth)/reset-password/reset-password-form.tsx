'use client'

import { useActionState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Field } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { resetPassword } from '@/lib/auth/actions'
import { idleState } from '@/types/api'

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPassword, idleState)
  const errors = state.status === 'error' ? state.fieldErrors : undefined

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Alert state={state} />

      <Field
        label="Nueva contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        required
        minLength={8}
        hint="Mínimo 8 caracteres"
        errors={errors?.password}
      />

      <Field
        label="Repite la contraseña"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        required
        errors={errors?.passwordConfirm}
      />

      <SubmitButton pendingText="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  )
}
