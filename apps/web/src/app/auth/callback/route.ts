import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Punto de aterrizaje de los enlaces enviados por email: confirmación de
 * cuenta, magic link y restablecimiento de contraseña.
 *
 * Supabase envía un `code` de un solo uso que aquí se canjea por una sesión
 * en cookies. Sin este intercambio, el usuario volvería a la aplicación sin
 * sesión y el enlace no serviría de nada.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  // Solo rutas internas: un `next` absoluto convertiría este endpoint en un
  // redirector abierto hacia sitios de terceros.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=enlace_invalido`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=enlace_caducado`)
  }

  return NextResponse.redirect(`${origin}${safeNext}`)
}
