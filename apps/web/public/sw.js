/**
 * Service worker de MotoGPorra.
 *
 * Escrito a mano y no generado por Serwist a propósito: `@serwist/next` en modo
 * plugin engancha por `config.webpack()`, que Turbopack no llama nunca, y el
 * modo configurator obliga a un paso de build extra que rastrea el interior de
 * `.next/`. Aquí no hace falta ninguna de las dos cosas.
 *
 * LA REGLA: solo se guarda lo que es público e inmutable. Todas las páginas de
 * la app pasan por `requireUser()`, así que su HTML y sus cargas RSC son
 * distintas para cada usuario; cachearlas significaría poder servirle a alguien
 * la pantalla renderizada de otro. Por eso la navegación va siempre a la red y
 * lo único que se guarda es `/_next/static/*` (con hash en el nombre) y los
 * iconos.
 *
 * Al subir VERSION se descarta el caché anterior entero en `activate`.
 */
const VERSION = 'v1'
const CACHE = `motogporra-${VERSION}`

const PAGINA_OFFLINE = '/offline'

/** Lo mínimo para que una navegación sin red no acabe en el dinosaurio. */
const PRECARGA = [PAGINA_OFFLINE, '/icons/icon-192.png']

/** Rutas de contenido público cuyo nombre ya identifica la versión del fichero. */
function esEstaticoInmutable(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECARGA))
      // Sin `skipWaiting` el worker nuevo esperaría a que se cierren todas las
      // pestañas. Es seguro hacerlo aquí porque no cacheamos nada versionado
      // por sesión: lo peor que puede pasar es servir un estático ya válido.
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((clave) => clave !== CACHE).map((clave) => caches.delete(clave))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Un POST no se cachea jamás: son Server Actions y escrituras.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Supabase, Auth y cualquier tercero salen por la red sin que los toquemos.
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(navegar(request))
    return
  }

  if (esEstaticoInmutable(url)) {
    event.respondWith(estatico(request))
  }

  // Todo lo demás —cargas RSC, rutas de API, el propio manifest— no se
  // intercepta: `respondWith` sin llamar deja pasar la petición tal cual.
})

/**
 * Navegación: red primero y **sin guardar la respuesta**, porque el HTML lleva
 * datos del usuario que la ha pedido. Si no hay red, la página de aviso.
 */
async function navegar(request) {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(CACHE)
    const offline = await cache.match(PAGINA_OFFLINE)
    return offline ?? Response.error()
  }
}

/** Estáticos: caché primero, que para un fichero con hash nunca queda obsoleto. */
async function estatico(request) {
  const cache = await caches.open(CACHE)

  const guardado = await cache.match(request)
  if (guardado) return guardado

  const respuesta = await fetch(request)

  // `status === 200` y no `ok`: un 206 es una respuesta parcial y guardarla
  // dejaría el fichero truncado en el caché para siempre.
  if (respuesta.status === 200 && respuesta.type === 'basic') {
    void cache.put(request, respuesta.clone())
  }

  return respuesta
}
