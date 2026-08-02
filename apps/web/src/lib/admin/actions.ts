'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth/session'
import { getSyncRuns, setRaceStatusOverride, setUserRole } from '@/services/admin.service'
import { dispararSync, TRABAJOS } from '@/services/sync.service'
import { errorState, successState, type ActionState } from '@/types/api'

/**
 * Estos `requireAdmin()` **sí** son necesarios, a diferencia de los del layout.
 *
 * Una Server Action es un endpoint HTTP: cualquiera puede invocarla sin pasar
 * por la página que la contiene, así que el guardia del layout no la cubre. La
 * RLS volvería a rechazar la escritura de todas formas, pero fallar aquí da un
 * mensaje claro en vez de un error opaco de PostgREST.
 */

/** `null` devuelve la carrera al estado calculado; el resto lo fuerza. */
const overrideSchema = z.object({
  raceId: z.uuid('Carrera no válida'),
  status: z.enum(['upcoming', 'open', 'closed', 'finished', 'cancelled', 'auto']),
})

export async function overrideRaceStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const parsed = overrideSchema.safeParse({
    raceId: formData.get('raceId'),
    status: formData.get('status'),
  })

  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? 'Datos no válidos')
  }

  const { raceId, status } = parsed.data

  try {
    await setRaceStatusOverride(raceId, status === 'auto' ? null : status)
  } catch (error) {
    return errorState(error instanceof Error ? error.message : 'No se pudo cambiar')
  }

  // El estado de una carrera se ve en media aplicación, así que se invalidan
  // también las rutas de jugador y no solo el panel.
  revalidatePath('/admin/races')
  revalidatePath('/races')
  revalidatePath(`/races/${raceId}`)
  revalidatePath('/')

  return successState(
    status === 'auto'
      ? 'Estado devuelto al cálculo automático'
      : `Estado forzado a «${status}»`,
  )
}

const syncSchema = z.object({ job: z.enum(TRABAJOS) })

export async function runSync(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin()

  const parsed = syncSchema.safeParse({ job: formData.get('job') })
  if (!parsed.success) return errorState('Trabajo no válido')

  // Freno best-effort contra el doble clic y contra lanzar cuatro seguidas.
  //
  // Es "best-effort" de verdad y no una promesa: `sync_runs` la escribe el
  // propio job, que tarda ~30 s en arrancar en GitHub, así que dos pulsaciones
  // muy seguidas no lo verían. Lo que impide de verdad que se solapen es el
  // `concurrency: sync` del workflow; esto solo evita encolar por error.
  const [ultima] = await getSyncRuns(1)

  if (ultima?.state === 'running') {
    return errorState('Ya hay una sincronización en marcha')
  }

  if (ultima && Date.now() - new Date(ultima.started_at).getTime() < 60_000) {
    return errorState('Espera un minuto entre sincronizaciones')
  }

  try {
    await dispararSync(parsed.data.job, admin.id)
  } catch (error) {
    return errorState(error instanceof Error ? error.message : 'No se pudo lanzar')
  }

  revalidatePath('/admin/sync')
  revalidatePath('/admin')

  return successState(
    `Lanzado «${parsed.data.job}». Tarda unos segundos en aparecer abajo.`,
  )
}

const roleSchema = z.object({
  userId: z.uuid('Usuario no válido'),
  role: z.enum(['admin', 'player']),
})

export async function changeUserRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin()

  const parsed = roleSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  })

  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? 'Datos no válidos')
  }

  // Quitarse el rol a uno mismo deja la porra sin ningún administrador si es el
  // único, y para recuperarlo hay que entrar a la base de datos a mano. Es
  // barato impedirlo aquí.
  if (parsed.data.userId === admin.id && parsed.data.role !== 'admin') {
    return errorState('No puedes quitarte a ti mismo el rol de administrador')
  }

  try {
    await setUserRole(parsed.data.userId, parsed.data.role)
  } catch (error) {
    return errorState(error instanceof Error ? error.message : 'No se pudo cambiar')
  }

  revalidatePath('/admin/users')

  return successState('Rol actualizado')
}
