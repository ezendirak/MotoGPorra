import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/lib/config/env'
import type { Database } from '@/types/database.types'

/**
 * Rutas accesibles sin sesión.
 *
 * `/offline` está aquí porque el service worker la precarga en su `install`,
 * que ocurre en la primera visita y puede no haber usuario todavía. Si el proxy
 * la redirigiese a `/login`, lo que quedaría cacheado como página de "sin
 * conexión" sería el formulario de acceso.
 */
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth',
  '/offline',
]

const isPublicRoute = (pathname: string) =>
  PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))

/**
 * Refresca la sesión en cada navegación y redirige de forma optimista.
 *
 * "Optimista" es literal: la documentación de Next.js desaconseja usar el
 * proxy como solución de autorización, y aquí solo sirve para dos cosas —
 * mantener vivo el token y evitar que un usuario sin sesión vea el esqueleto
 * de una página privada. La autorización REAL es la RLS de la base de datos,
 * que se aplica aunque alguien llame a la API saltándose el frontend entero.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // `getUser()` y no `getSession()`: getSession lee la cookie sin validarla
  // contra el servidor de Auth, así que un token manipulado pasaría el filtro.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Para devolver al usuario donde quería ir tras identificarse.
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Con sesión activa, las pantallas de acceso no tienen sentido.
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
