'use client'

import { useActionState } from 'react'

import { Alert } from '@/components/ui/alert'
import { changeUserRole } from '@/lib/admin/actions'
import { idleState } from '@/types/api'
import type { AppRole } from '@/services/admin.service'

/**
 * Alterna entre jugador y administrador.
 *
 * Un botón que dice a qué se cambia, no un desplegable: solo hay dos roles y
 * un `<select>` de dos opciones más un botón de aplicar son tres interacciones
 * para lo que se resuelve en una.
 */
export function UserRoleControl({
  userId,
  role,
  esUnoMismo,
}: {
  userId: string
  role: AppRole
  esUnoMismo: boolean
}) {
  const [state, formAction] = useActionState(changeUserRole, idleState)

  const siguiente: AppRole = role === 'admin' ? 'player' : 'admin'

  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={siguiente} />

      <button
        type="submit"
        disabled={esUnoMismo && role === 'admin'}
        title={
          esUnoMismo && role === 'admin'
            ? 'No puedes quitarte a ti mismo el rol de administrador'
            : undefined
        }
        className="h-9 rounded-lg border border-zinc-700 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {role === 'admin' ? 'Hacer jugador' : 'Hacer admin'}
      </button>

      {state.status === 'error' && (
        <div className="mt-2">
          <Alert state={state} />
        </div>
      )}
    </form>
  )
}
