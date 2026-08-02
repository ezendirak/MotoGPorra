/**
 * Resultado de una Server Action.
 *
 * Las acciones nunca lanzan excepciones hacia el cliente: devuelven un estado
 * explícito que el formulario renderiza. Así los errores de validación y los
 * del servidor se tratan igual y no hay pantallas de error genéricas.
 */
export type ActionState =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | {
      status: 'error'
      message: string
      /** Errores por campo, para pintarlos junto a cada input. */
      fieldErrors?: Record<string, string[]>
    }

export const idleState: ActionState = { status: 'idle' }

export const errorState = (
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionState =>
  fieldErrors ? { status: 'error', message, fieldErrors } : { status: 'error', message }

export const successState = (message?: string): ActionState =>
  message ? { status: 'success', message } : { status: 'success' }
