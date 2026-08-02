import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
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
