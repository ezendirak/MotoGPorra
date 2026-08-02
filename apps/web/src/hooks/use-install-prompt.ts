'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

/**
 * `beforeinstallprompt` no está en las librerías de TypeScript porque no es
 * estándar: solo lo implementan los navegadores basados en Chromium.
 */
type EventoInstalacion = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type EstadoInstalacion =
  /** Ya instalada, no soportado, o el usuario dijo que no. */
  | 'oculto'
  /** Chromium nos ha dado el evento: podemos abrir el diálogo del sistema. */
  | 'nativo'
  /** Safari en iOS: no hay diálogo, solo se puede explicar cómo se hace. */
  | 'ios'

const CLAVE_DESCARTE = 'motogporra:instalacion-descartada'

/** Lo que se sabe del entorno nada más cargar, antes de recibir ningún evento. */
type Entorno = 'oculto' | 'ios' | 'esperando'

function leerEntorno(): Entorno {
  // Abierta desde la pantalla de inicio: ya está instalada, no hay nada que
  // ofrecer. `navigator.standalone` es el equivalente propietario de Safari.
  const instalada =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true

  if (instalada || localStorage.getItem(CLAVE_DESCARTE) === '1') return 'oculto'

  const ua = navigator.userAgent
  // iPadOS 13+ se identifica como Mac; lo delata que tenga pantalla táctil.
  const esIOS =
    /iphone|ipod|ipad/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)

  return esIOS ? 'ios' : 'esperando'
}

/**
 * En el servidor no hay `window`, así que el HTML sale siempre sin invitación
 * y React la añade al hidratar. Pasar por `useSyncExternalStore` en vez de por
 * un `useEffect` que llame a `setState` evita el render en cascada — es la
 * misma razón por la que en el resto del proyecto no se resetea estado desde
 * un efecto.
 */
const leerEntornoEnServidor = (): Entorno => 'oculto'

/** El entorno no cambia durante una carga: no hay nada a lo que suscribirse. */
const sinSuscripcion = () => () => {}

/**
 * Decide si ofrecer la instalación de la PWA y cómo.
 *
 * Safari no expone `beforeinstallprompt` ni ninguna API de instalación, así que
 * en iPhone la única vía es enseñar los pasos de "Compartir → Añadir a pantalla
 * de inicio". De ahí que el estado tenga dos modos distintos en vez de uno.
 */
export function useInstallPrompt() {
  const entorno = useSyncExternalStore(sinSuscripcion, leerEntorno, leerEntornoEnServidor)
  const [evento, setEvento] = useState<EventoInstalacion | null>(null)
  const [silenciado, setSilenciado] = useState(false)

  useEffect(() => {
    // En iOS el evento no llega nunca y si ya está instalada no interesa.
    if (entorno !== 'esperando') return

    const alRecibir = (e: Event) => {
      // Sin esto el navegador enseña su propia barra de instalación, y queremos
      // elegir el momento: dentro de la app, no encima del formulario de login.
      e.preventDefault()
      setEvento(e as EventoInstalacion)
    }

    const alInstalar = () => {
      localStorage.setItem(CLAVE_DESCARTE, '1')
      setEvento(null)
      setSilenciado(true)
    }

    window.addEventListener('beforeinstallprompt', alRecibir)
    window.addEventListener('appinstalled', alInstalar)

    return () => {
      window.removeEventListener('beforeinstallprompt', alRecibir)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [entorno])

  const instalar = useCallback(async () => {
    if (!evento) return

    await evento.prompt()
    const { outcome } = await evento.userChoice

    // El evento es de un solo uso: el navegador no lo vuelve a emitir en esta
    // carga, así que se descarta pase lo que pase. Si acepta, el resto lo hace
    // el manejador de `appinstalled`.
    setEvento(null)

    if (outcome === 'dismissed') {
      localStorage.setItem(CLAVE_DESCARTE, '1')
      setSilenciado(true)
    }
  }, [evento])

  const descartar = useCallback(() => {
    localStorage.setItem(CLAVE_DESCARTE, '1')
    setSilenciado(true)
  }, [])

  const estado: EstadoInstalacion =
    silenciado || entorno === 'oculto'
      ? 'oculto'
      : entorno === 'ios'
        ? 'ios'
        : evento
          ? 'nativo'
          : 'oculto'

  return { estado, instalar, descartar }
}
