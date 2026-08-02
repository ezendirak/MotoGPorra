'use client'

import { useInstallPrompt } from '@/hooks/use-install-prompt'

/**
 * Invitación a instalar la app.
 *
 * Va anclada sobre la navegación inferior en lugar de en un modal: es una
 * sugerencia, no una decisión que haya que tomar ahora, y un modal centrado
 * obligaría a atenderla. Se descarta y no vuelve.
 *
 * El `bottom-20` la coloca justo encima de la barra de navegación (h-14 más el
 * área segura), que es fija.
 */
export function InstallPrompt() {
  const { estado, instalar, descartar } = useInstallPrompt()

  if (estado === 'oculto') return null

  return (
    <div
      role="complementary"
      aria-label="Instalar la aplicación"
      className="fixed inset-x-0 bottom-20 z-30 mx-auto max-w-md px-4 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-lg shadow-black/50">
        <span className="text-2xl" aria-hidden="true">
          🏁
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Instala MotoGPorra</p>

          {estado === 'ios' ? (
            <p className="mt-1 text-xs text-zinc-400">
              Toca <IconoCompartir /> <span className="text-zinc-300">Compartir</span> y
              luego{' '}
              <strong className="font-medium text-zinc-300">
                Añadir a pantalla de inicio
              </strong>
              .
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-zinc-400">
                Se abre a pantalla completa y entras de un toque.
              </p>
              <button
                type="button"
                onClick={() => void instalar()}
                className="mt-3 h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                Instalar
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={descartar}
          aria-label="No instalar"
          className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/**
 * El icono de compartir de iOS, dibujado.
 *
 * El glifo de SF Symbols (`􀈂`) vive en el área de uso privado de Unicode: se ve
 * en un iPhone y en el resto de sitios sale un cuadrado. Como estas
 * instrucciones también se leen en un iPad simulado o en las capturas, va como
 * SVG.
 */
function IconoCompartir() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block align-[-1px] text-zinc-300"
    >
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}
