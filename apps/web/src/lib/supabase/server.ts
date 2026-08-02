import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { env } from '@/lib/config/env'
import type { Database } from '@/types/database.types'

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Usa el JWT del usuario guardado en cookies, así que TODAS las consultas
 * pasan por RLS. Es el cliente por defecto: si dudas, este es el que quieres.
 *
 * En Next.js 16 `cookies()` es asíncrona de forma obligatoria — el acceso
 * síncrono se eliminó —, de ahí que la función sea `async`.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Los Server Components no pueden escribir cookies. Se ignora
            // sin ruido porque el proxy ya refresca la sesión en cada
            // navegación; este catch solo evita que un render reviente.
          }
        },
      },
    },
  )
}
