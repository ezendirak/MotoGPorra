'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { env } from '@/lib/config/env'
import { createClient } from '@/lib/supabase/server'
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@/lib/validation/auth.schema'
import { errorState, successState, type ActionState } from '@/types/api'

/**
 * Zod 4 sustituyó `error.flatten()` por la función suelta `z.flattenError()`.
 * Se encapsula aquí para no repetir el detalle en cada acción.
 */
function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>
}

/**
 * Traduce los errores de Supabase Auth, que llegan en inglés y con detalle
 * variable, a mensajes en castellano que el usuario pueda entender.
 *
 * Deliberadamente NO se distingue entre "email inexistente" y "contraseña
 * incorrecta": diferenciarlos convierte el formulario en un oráculo para
 * averiguar quién está registrado.
 */
function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos'
  if (m.includes('email not confirmed')) {
    return 'Tienes que confirmar tu email antes de entrar. Revisa tu bandeja de entrada.'
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Ya existe una cuenta con ese email'
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  }
  if (m.includes('weak password') || m.includes('password should be')) {
    return 'La contraseña es demasiado débil'
  }
  if (m.includes('same password')) {
    return 'La nueva contraseña debe ser distinta de la anterior'
  }
  return 'No se ha podido completar la operación. Inténtalo de nuevo.'
}

export async function login(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    redirectTo: formData.get('redirectTo') ?? undefined,
  })

  if (!parsed.success) {
    return errorState('Revisa los datos introducidos', fieldErrorsOf(parsed.error))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) return errorState(translateAuthError(error.message))

  // Solo se acepta una ruta interna: un `redirectTo` con URL absoluta
  // permitiría usar el login como trampolín hacia un sitio externo.
  const target = parsed.data.redirectTo
  const safeTarget =
    target && target.startsWith('/') && !target.startsWith('//') ? target : '/'

  redirect(safeTarget)
}

export async function register(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    displayName: formData.get('displayName'),
    email: formData.get('email'),
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  })

  if (!parsed.success) {
    return errorState('Revisa los datos introducidos', fieldErrorsOf(parsed.error))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Lo lee el trigger `handle_new_user` para crear el perfil.
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) return errorState(translateAuthError(error.message))

  return successState(
    'Cuenta creada. Te hemos enviado un email para confirmar tu dirección.',
  )
}

export async function forgotPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') })

  if (!parsed.success) {
    return errorState('Revisa el email introducido', fieldErrorsOf(parsed.error))
  }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  })

  // Se responde igual exista o no la cuenta: lo contrario permitiría
  // enumerar qué direcciones están registradas.
  return successState(
    'Si existe una cuenta con ese email, recibirás un enlace para restablecer la contraseña.',
  )
}

export async function resetPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  })

  if (!parsed.success) {
    return errorState('Revisa los datos introducidos', fieldErrorsOf(parsed.error))
  }

  const supabase = await createClient()

  // El enlace del email ya dejó una sesión activa; sin ella no hay a quién
  // cambiarle la contraseña.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return errorState('El enlace ha caducado. Solicita uno nuevo.')
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return errorState(translateAuthError(error.message))

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
