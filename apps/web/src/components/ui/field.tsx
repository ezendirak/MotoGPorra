import type { InputHTMLAttributes } from 'react'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  name: string
  errors?: string[] | undefined
  hint?: string
}

/**
 * Campo de formulario con etiqueta, ayuda y errores.
 *
 * Altura de 48px para cumplir el mínimo táctil de 44px con holgura, y
 * `aria-describedby` enlazado al mensaje de error para que un lector de
 * pantalla lo anuncie al enfocar el campo.
 */
export function Field({ label, name, errors, hint, className, ...props }: FieldProps) {
  const errorId = `${name}-error`
  const hintId = `${name}-hint`
  const hasError = Boolean(errors?.length)

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-zinc-200">
        {label}
      </label>

      <input
        id={name}
        name={name}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : hint ? hintId : undefined}
        className={[
          'h-12 rounded-xl border bg-zinc-900 px-4 text-base text-zinc-100',
          'placeholder:text-zinc-500',
          'focus:ring-2 focus:ring-red-500/60 focus:outline-none',
          hasError ? 'border-red-500' : 'border-zinc-700',
          className ?? '',
        ].join(' ')}
        {...props}
      />

      {hint && !hasError && (
        <p id={hintId} className="text-xs text-zinc-500">
          {hint}
        </p>
      )}

      {hasError && (
        <p id={errorId} className="text-xs text-red-400">
          {errors?.[0]}
        </p>
      )}
    </div>
  )
}
