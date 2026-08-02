import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

/**
 * En Next.js 16 el antiguo `middleware.ts` pasa a llamarse `proxy.ts`, la
 * función exportada debe llamarse `proxy` y el runtime es siempre `nodejs`
 * (el runtime `edge` ya no está soportado aquí).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Todas las rutas salvo:
     * - _next/static y _next/image (estáticos generados)
     * - favicon, manifest, service worker e iconos de la PWA
     * - cualquier fichero con extensión (imágenes, fuentes...)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
