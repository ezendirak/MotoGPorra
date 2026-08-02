import { z } from 'zod'

/**
 * Reglas de contraseña.
 *
 * Longitud mínima 8 y nada más: los requisitos de "una mayúscula, un número y
 * un símbolo" empujan a la gente hacia contraseñas cortas y predecibles del
 * tipo `Porra1!`. Supabase ya bloquea las filtradas en brechas conocidas si se
 * activa esa opción, que es una defensa mucho más real.
 */
const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar los 72 caracteres')

const email = z
  .email('Introduce un email válido')
  .transform((value) => value.trim().toLowerCase())

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Introduce tu contraseña'),
  redirectTo: z.string().optional(),
})

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(40, 'El nombre no puede superar los 40 caracteres'),
    email,
    password,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirm'],
  })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirm'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
