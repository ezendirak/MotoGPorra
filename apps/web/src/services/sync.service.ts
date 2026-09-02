import 'server-only'

import { getServerEnv } from '@/lib/config/env.server'

/** Los mismos valores que acepta el input `job` de `sync.yml`. */
export const TRABAJOS = [
  'results',
  'calendar',
  'riders',
  'images',
  'backfill',
  'all',
] as const
export type TrabajoSync = (typeof TRABAJOS)[number]

/** Fichero del workflow, tal cual se llama en `.github/workflows/`. */
const WORKFLOW = 'sync.yml'

/**
 * ¿Está configurado el disparo manual?
 *
 * El token y el repositorio son opcionales en el entorno: sin ellos la
 * aplicación funciona entera salvo este botón, y es preferible que el panel lo
 * diga a que el botón exista y falle al pulsarlo.
 */
export function puedeDispararSync(): boolean {
  const { GITHUB_SYNC_TOKEN, GITHUB_SYNC_REPO } = getServerEnv()
  return Boolean(GITHUB_SYNC_TOKEN && GITHUB_SYNC_REPO)
}

/**
 * Lanza el sincronizador con `workflow_dispatch`.
 *
 * Al ser monorepo (decisión 7) basta disparar sobre el propio repositorio;
 * `repository_dispatch` solo haría falta para un repo distinto y obliga a
 * enrutar a mano un tipo de evento.
 *
 * **No espera al sincronizador.** Dispara y devuelve: una función serverless
 * tiene límite de duración y un `backfill` son ~44 peticiones a MotoGP. Quien
 * quiera saber cómo fue mira `sync_runs`, que es para lo que existe.
 */
export async function dispararSync(
  job: TrabajoSync,
  /** UUID del administrador: acaba en `sync_runs.triggered_by` (§4.11). */
  triggeredBy: string,
): Promise<void> {
  const { GITHUB_SYNC_TOKEN, GITHUB_SYNC_REPO } = getServerEnv()

  if (!GITHUB_SYNC_TOKEN || !GITHUB_SYNC_REPO) {
    throw new Error('El disparo manual no está configurado en este entorno')
  }

  const respuesta = await fetch(
    `https://api.github.com/repos/${GITHUB_SYNC_REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_SYNC_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { job, triggered_by: triggeredBy },
      }),
      // Nunca cachear una petición que provoca un efecto.
      cache: 'no-store',
    },
  )

  // La documentación dice 200 y la API ha devuelto 204 históricamente. Se
  // acepta cualquier 2xx en vez de comparar con un número concreto que puede
  // cambiar sin avisar.
  if (respuesta.ok) return

  // El cuerpo del error de GitHub es útil (`Workflow does not have
  // 'workflow_dispatch' trigger`, `Resource not accessible by personal access
  // token`…), pero puede traer detalles del token: se registra en servidor y a
  // la interfaz va un mensaje traducido.
  const detalle = await respuesta.text().catch(() => '')
  console.error(`workflow_dispatch falló (${respuesta.status}):`, detalle)

  throw new Error(traducirErrorGitHub(respuesta.status))
}

function traducirErrorGitHub(status: number): string {
  if (status === 401) return 'El token de GitHub no es válido o ha caducado'
  if (status === 403) {
    return 'Al token le falta el permiso «Actions: Read and write» sobre el repositorio'
  }
  if (status === 404) {
    return 'No se encuentra el repositorio o el workflow. Revisa GITHUB_SYNC_REPO'
  }
  if (status === 422) return 'GitHub ha rechazado los parámetros del trabajo'
  return `GitHub ha respondido ${status}`
}
