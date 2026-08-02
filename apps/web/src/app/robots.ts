import type { MetadataRoute } from 'next'

/**
 * Ninguna página de la porra debe indexarse.
 *
 * Todo lo que hay detrás exige sesión, así que un buscador solo alcanzaría el
 * login y el registro — y que el registro sea abierto (decisión 5) no significa
 * que queramos atraer a desconocidos desde Google. Sin este fichero, además,
 * los `redirectTo` acabarían apareciendo en resultados de búsqueda.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  }
}
