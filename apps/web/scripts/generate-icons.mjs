/**
 * Genera los iconos de la PWA a partir de un SVG definido aquí mismo.
 *
 * Los PNG resultantes se versionan en `public/icons/`: este script se ejecuta
 * a mano (`npm run icons`) cuando cambia el diseño, no en cada build. Por eso
 * puede apoyarse en `sharp`, que llega como dependencia transitiva de Next y
 * no está declarada: si algún día desapareciera, los iconos ya están en git y
 * lo único que se pierde es poder regenerarlos.
 *
 * El motivo del dibujo es el podio, que es literalmente lo que se apuesta, con
 * el bloque del ganador en el rojo de la marca. Se lee a 48 px, que es el
 * tamaño real en la pantalla de inicio de un móvil; un logotipo con texto, no.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const FONDO = '#09090b' // zinc-950, el mismo del body
const ORO = '#dc2626' // brand-600
const PLATA = '#52525b' // zinc-600
const BRONCE = '#3f3f46' // zinc-700
const TIZA = '#fafafa'

/**
 * Contenido del icono sobre un lienzo de 512×512, sin el fondo.
 *
 * El dibujo ocupa de y=206 a y=444, así que su centro cae en 325 y no en 256.
 * El desplazamiento lo recoloca: sin él, la máscara circular de Android deja
 * el podio pegado al borde inferior.
 */
const DIBUJO = `
  <g transform="translate(0 -69)">
    <rect x="196" y="206" width="120" height="190" rx="6" fill="${ORO}" />
    <rect x="76"  y="276" width="120" height="120" rx="6" fill="${PLATA}" />
    <rect x="316" y="306" width="120" height="90"  rx="6" fill="${BRONCE}" />
    ${cuadros()}
  </g>
`

/**
 * Banda a cuadros bajo el podio: dos filas de ocho celdas alternas.
 * Es lo que hace que el icono se lea como «carreras» y no como «estadísticas».
 */
function cuadros() {
  const celdas = []
  for (let fila = 0; fila < 2; fila += 1) {
    for (let columna = 0; columna < 8; columna += 1) {
      const claro = (fila + columna) % 2 === 0
      celdas.push(
        `<rect x="${76 + columna * 45}" y="${404 + fila * 20}" width="45" height="20" fill="${claro ? TIZA : FONDO}" />`,
      )
    }
  }
  return celdas.join('\n    ')
}

/**
 * @param {{ recorte?: boolean }} opciones
 *   `recorte` encoge el dibujo al 80 % centrado, que es la zona segura que
 *   Android garantiza no recortar en los iconos `maskable`. Sin esto, una
 *   máscara circular se comería la banda a cuadros.
 */
function svg({ recorte = false } = {}) {
  const contenido = recorte
    ? `<g transform="translate(51.2 51.2) scale(0.8)">${DIBUJO}</g>`
    : DIBUJO

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${FONDO}" />
    ${contenido}
  </svg>`
}

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const destino = path.join(raiz, 'public', 'icons')
await mkdir(destino, { recursive: true })

const salidas = [
  { fichero: 'icon-192.png', tamano: 192, fuente: svg() },
  { fichero: 'icon-512.png', tamano: 512, fuente: svg() },
  { fichero: 'icon-maskable-512.png', tamano: 512, fuente: svg({ recorte: true }) },
  // iOS ignora el manifest para el icono de la pantalla de inicio y aplica su
  // propia máscara redondeada, así que va sin canal alfa y sin esquinas propias.
  { fichero: 'apple-touch-icon.png', tamano: 180, fuente: svg(), plano: true },
]

// `process.stdout` y no `console.log`: el linter solo admite warn y error, y
// esto es la salida normal de un script de línea de comandos, no un aviso.
const informar = (linea) => process.stdout.write(`✓ ${linea}\n`)

for (const { fichero, tamano, fuente, plano } of salidas) {
  let imagen = sharp(Buffer.from(fuente)).resize(tamano, tamano)
  if (plano) imagen = imagen.flatten({ background: FONDO })
  await imagen.png({ compressionLevel: 9 }).toFile(path.join(destino, fichero))
  informar(`icons/${fichero} (${tamano}×${tamano})`)
}

// El SVG queda también como fuente editable, útil para exportar a otros tamaños.
await writeFile(path.join(destino, 'icon.svg'), svg(), 'utf8')
informar('icons/icon.svg')
