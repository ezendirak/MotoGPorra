import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { env } from '@/lib/config/env'
import { getServerEnv } from '@/lib/config/env.server'
import type { Database } from '@/types/database.types'

/**
 * Cliente con `service_role`: **BYPASSA RLS POR COMPLETO**.
 *
 * El `import 'server-only'` de arriba hace que cualquier intento de importar
 * este módulo desde un Client Component rompa el build, en vez de filtrar la
 * clave en producción.
 *
 * Solo debe usarse para operaciones de administración que RLS no puede
 * expresar: gestionar usuarios de `auth`, disparar sincronizaciones o
 * recalcular puntuaciones. Para cualquier otra cosa, usa `server.ts`: si el
 * usuario no debería poder hacer algo, la política RLS debe impedirlo, y este
 * cliente se salta esa protección.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv()

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        // Es un cliente de servidor sin usuario: no debe persistir ni
        // refrescar sesión alguna.
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
