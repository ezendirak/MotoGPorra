import { createBrowserClient } from '@supabase/ssr'

import { env } from '@/lib/config/env'
import type { Database } from '@/types/database.types'

/**
 * Cliente de Supabase para el navegador.
 *
 * Reservado a lo que de verdad necesita ejecutarse en el cliente: Realtime y
 * la subida de avatares. Todo lo demás debe leerse desde Server Components,
 * que no exponen ni una consulta al bundle.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
