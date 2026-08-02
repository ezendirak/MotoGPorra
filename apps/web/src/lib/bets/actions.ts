'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { betSchema } from '@/lib/validation/bet.schema'
import { errorState, successState, type ActionState } from '@/types/api'

/**
 * Códigos que lanza `place_bet`. Son estables por contrato: la función SQL
 * los emite con `RAISE EXCEPTION` y aquí se traducen a algo que el usuario
 * entienda. Cualquier otro error se trata como fallo genérico.
 */
const ERRORES: Record<string, string> = {
  AUTH_REQUIRED: 'Tienes que iniciar sesión para apostar.',
  RACE_NOT_FOUND: 'Esa carrera no existe.',
  RACE_CANCELLED: 'La carrera ha sido cancelada.',
  BETTING_CLOSED: 'Las apuestas ya están cerradas para esta carrera.',
  INVALID_PICK_COUNT: 'Tienes que elegir exactamente tres pilotos.',
  DUPLICATE_RIDER: 'No puedes elegir al mismo piloto dos veces.',
  RIDER_NOT_IN_SEASON: 'Alguno de los pilotos no compite en esta categoría.',
}

function traducir(mensaje: string): string {
  for (const [codigo, texto] of Object.entries(ERRORES)) {
    if (mensaje.includes(codigo)) return texto
  }
  return 'No se ha podido guardar la apuesta. Inténtalo de nuevo.'
}

export async function placeBet(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = betSchema.safeParse({
    raceId: formData.get('raceId'),
    riderIds: [
      formData.get('rider1'),
      formData.get('rider2'),
      formData.get('rider3'),
    ].filter((v): v is string => typeof v === 'string' && v.length > 0),
  })

  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? 'Revisa tu apuesta')
  }

  const supabase = await createClient()

  // Una sola llamada transaccional: valida la ventana temporal con el reloj
  // del servidor, comprueba los pilotos y reemplaza los picks de forma atómica.
  const { error } = await supabase.rpc('place_bet', {
    p_race_id: parsed.data.raceId,
    p_rider_ids: parsed.data.riderIds,
  })

  if (error) return errorState(traducir(error.message))

  revalidatePath('/')
  revalidatePath('/races')
  revalidatePath(`/races/${parsed.data.raceId}`)

  return successState('Apuesta guardada')
}
