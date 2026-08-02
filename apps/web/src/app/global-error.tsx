'use client'

/**
 * Último recurso: se activa cuando el fallo ocurre en el propio layout raíz,
 * que el `error.tsx` normal no envuelve.
 *
 * Sustituye al documento entero, así que tiene que traer sus propios `<html>` y
 * `<body>`. Y **no recibe los estilos globales**, de ahí que los colores vayan
 * en línea: sin ellos saldría texto negro sobre blanco, que en una app siempre
 * oscura canta muchísimo.
 *
 * Tampoco admite `export const metadata` por ser Client Component; el título se
 * pone con el componente `<title>` de React.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#09090b',
          color: '#f4f4f5',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <title>Error · MotoGPorra</title>

        <span style={{ fontSize: '2.25rem' }} aria-hidden="true">
          🔴
        </span>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Carrera suspendida</h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#a1a1aa' }}>
          La aplicación no ha podido arrancar. Vuelve a intentarlo en un momento.
        </p>

        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{
            marginTop: '0.5rem',
            height: '3rem',
            padding: '0 1.5rem',
            border: 0,
            borderRadius: '0.75rem',
            backgroundColor: '#dc2626',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>

        {error.digest && (
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#52525b' }}>
            Referencia: {error.digest}
          </p>
        )}
      </body>
    </html>
  )
}
