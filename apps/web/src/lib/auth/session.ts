import 'server-only'

import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * Usuario autenticado, o `null`.
 *
 * Siempre `getUser()` y nunca `getSession()`: este último se limita a leer la
 * cookie sin validarla contra el servidor de Auth, así que un token
 * manipulado la superaría.
 */
export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/** Exige sesión; si no la hay, manda a /login conservando el destino. */
export async function requireUser(redirectTo?: string) {
  const user = await getUser()
  if (!user) {
    const target = redirectTo
      ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
      : '/login'
    redirect(target)
  }
  return user
}

/** Perfil del usuario actual (nombre visible y avatar). */
export async function getProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return data
}

/**
 * Exige rol de administrador.
 *
 * Devuelve 404 en vez de 403 a propósito: quien no es administrador no tiene
 * por qué saber que el panel existe.
 *
 * Esto es solo la capa de experiencia de usuario. La protección real es la
 * RLS: aunque alguien llamara directamente a la API, no podría leer ni
 * escribir nada que no le corresponda.
 */
export async function requireAdmin() {
  const user = await requireUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (data?.role !== 'admin') notFound()

  return user
}
