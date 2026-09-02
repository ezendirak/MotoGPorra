import { createClient } from '@/lib/supabase/server'

export type BetPick = {
  position: number
  riderId: string
  riderName: string
  headshotUrl: string | null
  numberImageUrl: string | null
}

export type Bet = {
  id: string
  userId: string
  displayName: string
  picks: BetPick[]
}

/**
 * La apuesta del usuario actual para una carrera, o `null`.
 *
 * No hace falta filtrar por usuario: la política RLS `bets_select_own` ya lo
 * hace. Filtrar aquí también sería defensa en profundidad razonable, pero
 * confiar en RLS es lo correcto — si algún día falla, quiero que falle
 * ruidosamente y no que lo tape una condición del cliente.
 */
export async function getMyBet(raceId: string): Promise<Bet | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('bets')
    .select(
      'id,user_id,bet_picks(position,rider_id,riders(full_name,headshot_url,number_image_url))',
    )
    .eq('race_id', raceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw new Error(`No se pudo cargar tu apuesta: ${error.message}`)
  if (!data) return null

  return {
    id: data.id,
    userId: data.user_id,
    displayName: '',
    picks: toPicks(data.bet_picks),
  }
}

/**
 * Todas las apuestas de una carrera.
 *
 * Devuelve solo la propia mientras las apuestas estén abiertas: la política
 * `bets_select_others_after_close` filtra las ajenas hasta el cierre. Es la
 * protección real contra consultar la API para copiar al rival, y por eso
 * este servicio no necesita comprobar nada.
 */
export async function getRaceBets(raceId: string): Promise<Bet[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bets')
    .select(
      'id,user_id,bet_picks(position,rider_id,riders(full_name,headshot_url,number_image_url))',
    )
    .eq('race_id', raceId)

  if (error) throw new Error(`No se pudieron cargar las apuestas: ${error.message}`)
  if (!data?.length) return []

  // Los nombres se piden aparte y se cruzan aquí: `bets.user_id` apunta a
  // `auth.users`, no a `profiles`, así que PostgREST no puede incrustar el
  // perfil. Añadir una clave foránea redundante a `profiles` solo para que el
  // embed funcione ensuciaría el esquema por comodidad de una consulta.
  const { data: perfiles } = await supabase
    .from('profiles')
    .select('id,display_name')
    .in(
      'id',
      data.map((row) => row.user_id),
    )

  const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]))

  return data
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      displayName: nombrePorId.get(row.user_id) ?? 'Participante',
      picks: toPicks(row.bet_picks),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
}

type RawPick = {
  position: number
  rider_id: string
  riders: {
    full_name: string
    headshot_url: string | null
    number_image_url: string | null
  } | null
}

function toPicks(picks: RawPick[] | null): BetPick[] {
  return (picks ?? [])
    .map((p) => ({
      position: p.position,
      riderId: p.rider_id,
      riderName: p.riders?.full_name ?? 'Piloto',
      headshotUrl: p.riders?.headshot_url ?? null,
      numberImageUrl: p.riders?.number_image_url ?? null,
    }))
    .sort((a, b) => a.position - b.position)
}
