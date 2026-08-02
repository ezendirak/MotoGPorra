import type { MetadataRoute } from 'next'

/**
 * Manifest de la PWA.
 *
 * Se sirve en `/manifest.webmanifest`, ruta que el `proxy.ts` deja pasar sin
 * sesión: el navegador la pide antes de que exista usuario y una redirección a
 * `/login` haría que la app no fuese instalable.
 *
 * Es una función y no un `manifest.json` estático para que el nombre, los
 * colores y los atajos vivan en TypeScript y el compilador avise si el tipo
 * cambia entre versiones de Next.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'MotoGPorra',
    // Lo que cabe bajo el icono en la pantalla de inicio: unos 12 caracteres.
    short_name: 'MotoGPorra',
    description: 'La porra del Mundial de MotoGP: predice el podio de cada carrera.',
    lang: 'es',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    // La app está pensada en vertical y no tiene ninguna vista que gane girando.
    orientation: 'portrait',
    categories: ['sports', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android recorta el icono con la máscara del sistema (círculo, cuadrado
      // redondeado…) y solo respeta el 80 % central. Sin una variante
      // `maskable` rellenaría el resto con un fondo blanco propio.
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Accesos largos sobre el icono. Los tres destinos que se consultan solos.
    shortcuts: [
      { name: 'Calendario', short_name: 'Carreras', url: '/races' },
      { name: 'Clasificación', short_name: 'Clasificación', url: '/standings' },
    ],
  }
}
