'use client'

import { useFormStatus } from 'react-dom'

/**
 * Botón de envío que se deshabilita solo mientras la acción está en vuelo.
 *
 * `useFormStatus` lee el estado del `<form>` padre, así que el formulario no
 * necesita gestionar ningún `isPending` propio.
 */
export function SubmitButton({
  children,
  pendingText,
}: {
  children: React.ReactNode
  pendingText?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-xl bg-red-600 text-base font-semibold text-white transition-colors hover:bg-red-500 focus:ring-2 focus:ring-red-500/60 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (pendingText ?? 'Enviando…') : children}
    </button>
  )
}
