import { z } from 'zod'

/**
 * Variables de entorno públicas: se inlinean en el bundle de cliente, así que
 * aquí NO puede entrar ningún secreto. Los secretos viven en `env.server.ts`.
 *
 * Cada variable se lee de forma literal (`process.env.NEXT_PUBLIC_X`) y nunca
 * mediante índice dinámico: Next.js sustituye estas expresiones en tiempo de
 * compilación por su valor, y un acceso tipo `process.env[key]` no se sustituye
 * — quedaría `undefined` en el navegador.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY es obligatoria'),
  NEXT_PUBLIC_SITE_URL: z.url('NEXT_PUBLIC_SITE_URL debe ser una URL válida'),
})

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
})

if (!parsed.success) {
  throw new Error(
    `Variables de entorno públicas inválidas:\n${z.prettifyError(parsed.error)}`,
  )
}

export const env = parsed.data
