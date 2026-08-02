import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { ServiceWorker } from '@/components/layout/service-worker'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'MotoGPorra',
    template: '%s · MotoGPorra',
  },
  description: 'La porra del Mundial de MotoGP: predice el podio de cada carrera.',
  applicationName: 'MotoGPorra',
  // iOS no lee el manifest para el icono de la pantalla de inicio: si no hay
  // `apple-touch-icon`, Safari hace una captura de la página y la usa de icono.
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'MotoGPorra',
    // `black-translucent` extiende el fondo bajo la barra de estado, que es lo
    // que hace que la app instalada no parezca una web con un marco encima.
    // Funciona porque el layout ya respeta `safe-area-inset`.
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: '#09090b',
  // `viewportFit: cover` es lo que habilita las variables env(safe-area-inset-*)
  // que usamos para no meter contenido bajo la barra de gestos del iPhone.
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        {children}
        <ServiceWorker />
      </body>
    </html>
  )
}
