import type { ActionState } from '@/types/api'

/**
 * Mensaje de resultado de una acción.
 *
 * `role="alert"` hace que los lectores de pantalla lo anuncien en cuanto
 * aparece, sin que el usuario tenga que ir a buscarlo.
 */
export function Alert({ state }: { state: ActionState }) {
  if (state.status === 'idle') return null

  const isError = state.status === 'error'
  const message = state.status === 'error' ? state.message : state.message

  if (!message) return null

  return (
    <div
      role="alert"
      className={[
        'rounded-xl border px-4 py-3 text-sm',
        isError
          ? 'border-red-500/40 bg-red-500/10 text-red-300'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      ].join(' ')}
    >
      {message}
    </div>
  )
}
