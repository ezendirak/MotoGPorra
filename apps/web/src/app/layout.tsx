import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

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
      </body>
    </html>
  )
}
