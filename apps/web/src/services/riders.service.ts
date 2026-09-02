import { createClient } from '@/lib/supabase/server'

export type SeasonRider = {
  riderId: string
  fullName: string
  lastName: string | null
  number: number | null
  team: string | null
  teamColor: string | null
  countryCode: string | null
  /** Avatar cuadrado de cabeza y hombros. `null` hasta que el sync lo suba. */
  headshotUrl: string | null
  /** Dorsal con la tipografía del piloto. `null` si MotoGP no lo publica. */
  numberImageUrl: string | null
}

/**
 * Pilotos inscritos y ACTIVOS en una temporada y categoría.
 *
 * Es la lista que alimenta el selector de apuesta, y coincide con la que
 * valida `place_bet` en la base: si aquí apareciera alguien que la función
 * rechaza, el usuario vería un error incomprensible al guardar.
 */
export async function getSeasonRiders(
  seasonId: string,
  categoryId: string,
): Promise<SeasonRider[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rider_season_entries')
    .select(
      'number,sponsored_team,riders(id,full_name,last_name,country_code,headshot_url,number_image_url),teams(name,color)',
    )
    .eq('season_id', seasonId)
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('number', { ascending: true })

  if (error) throw new Error(`No se pudieron cargar los pilotos: ${error.message}`)

  return (data ?? [])
    .filter((row) => row.riders !== null)
    .map((row) => ({
      riderId: row.riders!.id,
      fullName: row.riders!.full_name,
      lastName: row.riders!.last_name,
      number: row.number,
      team: row.sponsored_team ?? row.teams?.name ?? null,
      teamColor: row.teams?.color ?? null,
      countryCode: row.riders!.country_code,
      headshotUrl: row.riders!.headshot_url,
      numberImageUrl: row.riders!.number_image_url,
    }))
}
