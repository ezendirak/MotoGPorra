import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Cabeceras para todo el sitio. Van primero: si una ruta concreta
        // necesita otro valor para la misma clave, la entrada posterior gana.
        source: '/(.*)',
        headers: [
          // Impide que el navegador adivine el tipo de un fichero por su
          // contenido, que es como un avatar subido acaba ejecutándose.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Nada de esta app tiene sentido dentro de un iframe, y prohibirlo
          // cierra el clickjacking sobre el formulario de apuesta.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Al salir hacia otro dominio solo viaja el origen, nunca la ruta:
          // las URL llevan identificadores de carrera y de usuario.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // No usamos ninguna de estas APIs; negarlas evita que una dependencia
          // las pida y el navegador enseñe un diálogo de permisos.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
      {
        // El navegador revalida `sw.js` en cada carga porque el registro usa
        // `updateViaCache: 'none'`, pero esa opción no cubre a los proxies ni
        // al CDN de Vercel. Sin `no-store`, un worker con un fallo podría
        // seguir sirviéndose durante horas y no habría manera de retirarlo.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          // El worker intercepta todas las peticiones de la app: conviene que
          // él mismo no pueda cargar código de ningún otro origen.
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ]
  },
}

export default nextConfig
