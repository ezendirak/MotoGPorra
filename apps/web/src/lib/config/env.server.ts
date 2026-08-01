import 'server-only'

import { z } from 'zod'

/**
 * Secretos de servidor. El import de `server-only` hace que cualquier intento
 * de importar este módulo desde un Client Component rompa el build en vez de
 * filtrar la clave en producción (ver docs/DESIGN.md §11.4, regla 4).
 *
 * `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS por completo: sólo puede usarse desde
 * `lib/supabase/admin.ts` y desde el servicio de sincronización.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY es obligatoria'),
  /** Token fine-grained con permiso `actions: write` para disparar el sync. */
  GITHUB_SYNC_TOKEN: z.string().min(1).optional(),
  GITHUB_SYNC_REPO: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'GITHUB_SYNC_REPO debe tener el formato owner/repo')
    .optional(),
})

let cached: z.infer<typeof serverEnvSchema> | null = null

/**
 * Se valida de forma perezosa y no al importar: así el build no falla en
 * entornos donde estos secretos no hacen falta (por ejemplo, un preview que
 * sólo renderiza páginas públicas).
 */
export function getServerEnv(): z.infer<typeof serverEnvSchema> {
  if (cached) return cached

  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GITHUB_SYNC_TOKEN: process.env.GITHUB_SYNC_TOKEN,
    GITHUB_SYNC_REPO: process.env.GITHUB_SYNC_REPO,
  })

  if (!parsed.success) {
    throw new Error(
      `Variables de entorno de servidor inválidas:\n${z.prettifyError(parsed.error)}`,
    )
  }

  cached = parsed.data
  return cached
}
