'use client'

import { useActionState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Field } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { register } from '@/lib/auth/actions'
import { idleState } from '@/types/api'

export function RegisterForm() {
  const [state, formAction] = useActionState(register, idleState)
  const errors = state.status === 'error' ? state.fieldErrors : undefined

  // Tras un alta correcta el formulario sobra: lo siguiente que debe hacer el
  // usuario es ir a su correo, no volver a rellenar campos.
  if (state.status === 'success') {
    return <Alert state={state} />
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Alert state={state} />

      <Field
        label="Nombre"
        name="displayName"
        autoComplete="nickname"
        placeholder="Cómo te verán los demás"
        required
        minLength={2}
        maxLength={40}
        errors={errors?.displayName}
      />

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

      <SubmitButton pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
    </form>
  )
}
