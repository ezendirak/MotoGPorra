'use client'

import { useEffect } from 'react'

/**
 * Registra el service worker. No pinta nada.
 *
 * Va en un componente y no en un `<script>` del layout porque el registro debe
 * ocurrir en el navegador y solo si el navegador lo soporta — Safari en modo
 * privado, por ejemplo, expone `navigator.serviceWorker` pero falla al
 * registrar, y un fallo aquí no debe romper la página.
 *
 * Se registra en dev también, aunque el worker apenas tenga qué cachear: es la
 * única forma de detectar en local que algo del worker está mal antes de
 * desplegarlo.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // `updateViaCache: 'none'` obliga a revalidar el propio sw.js contra el
    // servidor en cada carga. Sin esto, un worker con un fallo podría quedarse
    // cacheado por el navegador hasta 24 h y no habría forma de corregirlo.
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((error: unknown) => {
        console.error('No se pudo registrar el service worker:', error)
      })
  }, [])

  return null
}
