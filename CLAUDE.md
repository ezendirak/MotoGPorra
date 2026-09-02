# MotoGPorra

Porra anual de MotoGP. Cada participante predice el podio (🥇🥈🥉) de cada Gran Premio antes de que empiecen los entrenamientos. El resultado oficial se importa solo y las puntuaciones se recalculan sin intervención manual.

**La puntuación depende de QUÉ posiciones aciertes y NO es aditiva:** 1-2-3 vale 15, pero 1-2-X vale 10 y no los 7 que saldrían de sumar. Vive como tabla de consulta en `scoring_rules.points_by_pattern`, con clave de tres caracteres (`'110'` = acertar 1º y 2º). Un GP reparte de 0 a 15 puntos.

**No hay sprint.** Solo se apuesta a la carrera del domingo; `kind` sigue en el esquema por si volviera.

> Este fichero son las **reglas estables**. El estado del proyecto, las decisiones tomadas y lo que queda pendiente están en [docs/DESIGN.md](docs/DESIGN.md).

---

## La regla que gobierna todo

**La aplicación web nunca habla con MotoGP.** Todo dato deportivo entra por el sincronizador y sale de Supabase.

```
Navegador (PWA) → Next.js en Vercel → Supabase (Auth · PostgreSQL · RLS)
                                            ↑
                                    apps/sync (Python)
                                            ↓
                              motogp_client → API de MotoGP
```

| Frontera | Permitido | Prohibido |
|---|---|---|
| Navegador → Supabase | Lectura con RLS, realtime | Escritura en tablas deportivas |
| Next.js → Supabase | Lectura + RPC con el JWT del usuario | `service_role` fuera del módulo admin |
| Next.js → MotoGP | — | **Todo.** No existe cliente HTTP a MotoGP en `apps/web` |
| Python → MotoGP | Solo vía `motogp_client` | Llamadas HTTP propias |

---

## Stack

Next.js 16.2 (App Router, Turbopack) · React 19.2 · TypeScript estricto · Tailwind 4 · Zod 4 · Supabase · Python 3.12+ · Node 24 LTS

## Estructura

```
apps/web/                 Next.js + PWA
apps/sync/                Sincronización (Python)
packages/motogp_client/   Librería que encapsula la API de MotoGP
supabase/migrations/      Esquema y RLS
docs/DESIGN.md            Diseño y diario del proyecto
```

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run check        # formato + lint + tipos + tests  (pasar SIEMPRE antes de commitear)
npm test             # lógica pura con el runner de Node, sin dependencias
npm run build
npm run db:push      # aplicar migraciones nuevas al proyecto enlazado
npm run db:verify    # 36 pruebas de esquema, RLS y clasificación contra la base real
npx supabase gen types typescript --linked > apps/web/src/types/database.types.ts

npm run icons --workspace=web   # regenera los PNG de la PWA desde el SVG del script

.venv/Scripts/python -m motogporra_sync <riders|calendar|results|backfill|all>
cd packages/motogp_client && ../../.venv/Scripts/python -m pytest -q
```

---

## Convenciones de código

Estas tres las **verifica ESLint**, no la disciplina:

1. Nadie importa `@supabase/*` fuera de `src/lib/supabase/`.
2. `src/utils/` no importa nada del proyecto: funciones puras.
3. `src/services/` no importa React: lógica de negocio testeable.

Además:

- **Dónde va cada prueba.** Lógica pura → `*.test.ts` junto al fichero, con el runner de Node (`npm test`). Todo lo que dependa de RLS, funciones SQL o triggers → `supabase/tests/verify.mjs`, contra el proyecto real: una política solo es creíble ejecutándose.
- **Los componentes no consultan la base de datos.** Solo `services/*` construyen queries.
- **Server Components por defecto.** Client Component solo cuando aporta: formularios, cuenta atrás, hojas inferiores.
- **Tipos generados, nunca escritos a mano.** `database.types.ts` sale del CLI.
- **`lib/supabase/admin.ts` empieza con `import 'server-only'`.**
- TypeScript va más allá de `strict`: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. Con esta última, `?: string` y `string | undefined` **no** son lo mismo.
- Código y comentarios en castellano.

## Convenciones de base de datos

- `snake_case`, PK `uuid`, `created_at`/`updated_at` con trigger.
- **RLS activada en todas las tablas de `public`, sin excepción.** Sin política = sin acceso.
- Las vistas se crean con `security_invoker = true`, o bypasan la RLS de las tablas de debajo.
- Todo `motogp_*_id` es clave de reconciliación del sincronizador. **Nunca se casa por nombre.**
- El esquema `internal` no se expone por la Data API, pero `authenticated` necesita `USAGE` para que las políticas puedan llamar a sus funciones.

## Seguridad — no negociable

- **`getUser()`, nunca `getSession()`.** El segundo lee la cookie sin validarla contra Auth.
- **La RLS es la autorización real.** El `proxy.ts` es una comprobación optimista, y los `requireUser()` son experiencia de usuario.
- **Las apuestas ajenas solo son visibles tras el cierre**, y lo garantiza la política `bets_select_others_after_close`, no el JSX.
- `redirectTo` y `next` solo aceptan rutas internas (`/…`, nunca `//`).
- Login y recuperación **no distinguen** email inexistente de contraseña incorrecta.
- `service_role` bypasa RLS: solo en `apps/sync` y en `lib/supabase/admin.ts`.
- **El service worker no cachea nada autenticado.** Todas las rutas de `(app)` pasan por `requireUser()`: su HTML y sus cargas RSC son distintas por usuario, y guardarlos permitiría servirle a alguien la pantalla de otro. `public/sw.js` solo guarda `/_next/static/*` e `/icons/*`; la navegación va siempre a la red y cae en `/offline` si falla.

---

## Next.js 16 — cambios que rompen lo que sabías

| Cambio | Consecuencia |
|---|---|
| `middleware.ts` → **`proxy.ts`**, sin runtime `edge` | Función exportada `proxy`, runtime Node |
| `cookies()`, `headers()`, `params`, `searchParams` | **Solo asíncronos**; el acceso síncrono se eliminó |
| `next lint` eliminado | `next build` ya no lintea; el lint es paso propio |
| `revalidateTag` exige 2º argumento | Usar **`updateTag`** para *read-your-writes* |
| Rutas paralelas | Exigen `default.js` explícito |

Antes de escribir código de Next, consultar `node_modules/next/dist/docs/`.

## La API de MotoGP y sus trampas

Todas verificadas contra respuestas reales. Viven encapsuladas en `apps/sync/src/motogporra_sync/mappers.py`.

| Rareza | Detalle |
|---|---|
| **UUID de piloto en resultados** | `rider.id` de la clasificación pertenece a **otro espacio** que el de `/riders`. Hay que casar por **`riders_api_uuid`**, con `legacy_id` de respaldo. Casar por `rider.id` deja todas las puntuaciones a cero **en silencio** |
| Número de ronda | Es el campo `sequence`, no la posición en la lista |
| Zona horaria | Llega en MAYÚSCULAS (`AMERICA/SAO_PAULO`); normalizar a IANA tratando el guion bajo |
| Fechas | Las del **evento** traen desplazamiento local; las de **sesión** ya son UTC |
| Código de sesión | `type` no distingue FP1 de FP2: hay que componerlo con `number` |
| Estado de clasificación | Solo `INSTND`/`OUTSTND`. **No** diferencia DNF, DNS ni DSQ |
| Tiempos | Texto (`'40:53.148'`), no milisegundos |
| Pilotos | `/riders` devuelve más que la parrilla (29 vs 22); filtrar por `is_active` |

## Errores que ya cometimos una vez

- **Nunca escribir la cabecera antes que el contenido.** El sync creaba `race_results` como `official` y *luego* resolvía los pilotos; al abortar por un piloto sin resolver quedaba un resultado oficial vacío que el job daba por importado para siempre. Se resuelve todo lo que pueda fallar **antes** de la primera escritura, y la condición de «ya importado» exige que haya entradas, no solo cabecera.
- **`SELECT ... FOR SHARE` bajo RLS** evalúa también las políticas de **UPDATE**. Cualquier cláusula de bloqueo en una función `SECURITY INVOKER` exige que el rol tenga política de UPDATE sobre esa tabla.
- **Las vistas sin `security_invoker`** se ejecutan con permisos del propietario y bypasan la RLS.
- **Los triggers corren con los permisos de quien hace la operación**: hace falta `GRANT EXECUTE` sobre la función del trigger.
- **`bets` no tiene clave foránea a `profiles`** (`user_id` apunta a `auth.users`), así que PostgREST no puede incrustar el perfil: se cruza en JS.
- **No resetear estado desde un `useEffect`**: la regla `react-hooks/set-state-in-effect` lo rechaza. Para estado derivado, remontar con `key`; para datos que solo existen en el navegador (`matchMedia`, `localStorage`, `navigator`), **`useSyncExternalStore`** — un `useState` con valor inicial calculado rompería la hidratación.
- **Nada de librerías de build que enganchen por webpack**: aquí manda Turbopack, en `dev` y en `build`. Es lo que descartó Serwist (`@serwist/next` se engancha en `config.webpack()`, que Turbopack no llama nunca). Comprobar el bundler **antes** de adoptar el paquete.
- **`Intl` en un Server Component usa la zona del proceso, no la del navegador.** En Vercel es UTC y en un portátil español es `Europe/Madrid`, así que la misma carrera se anunciaba dos horas antes en producción. Todos los formateadores de `utils/date.ts` fijan `timeZone` explícitamente. **Cuidado al añadir uno nuevo.**
- **Los campos opcionales de `@supabase/auth-js` no son `null`, son `undefined`.** `email_confirmed_at?: string` desaparece del objeto cuando no aplica, así que `!== null` da `true` siempre y el compilador no protesta. Se comprueban con `Boolean(...)`. Ojo: los tipos **generados** de la base de datos sí usan `| null`, así que las dos convenciones conviven en el mismo fichero.
- **No usar `Set-Content` de PowerShell** sobre ficheros con acentos: destroza la codificación. Usar las herramientas de edición.
- **Todo fichero público servido desde la raíz hay que excluirlo del matcher de `proxy.ts`.** Si no, el proxy lo redirige a `/login` y quien lo pide (un crawler, un verificador de dominio) nunca lo recibe. Ya pasó con `robots.txt`. Aplica igual a `sitemap.xml` y a `.well-known/`.

## Entorno local

- **No hay Docker**: sin stack local de Supabase. Las migraciones van directas al proyecto enlazado y `supabase db dump` no funciona.
- **Sin ruta IPv6**: el host directo de Postgres (`db.<ref>.supabase.co`) es inalcanzable. Por eso `apps/sync` usa PostgREST y no `psycopg`, y por eso los jobs son idempotentes en vez de transaccionales. **Los runners de GitHub tampoco tienen IPv6** (medido).
- **Para conectar a Postgres de verdad, el session pooler.** Es IPv4 en todos los planes. El usuario **no es `postgres`** sino `postgres.<ref>`; usar el primero da `password authentication failed` o `tenant or user not found`, y ese malentendido ya nos costó dos diagnósticos equivocados. La cadena se copia del botón *Connect* del panel, pestaña **Session pooler**.
- Secretos en `.env` (raíz, para el sync) y `apps/web/.env.local`. Ambos ignorados por git.
- Los workflows necesitan `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL` en *Settings → Secrets → Actions*. La última solo la usa `backup.yml`: el host directo es IPv6 y desde aquí no se alcanza, pero los runners de GitHub sí.
- **El plan gratuito de Supabase no hace copias de seguridad** (eso es Pro) y **pausa el proyecto tras 7 días de poca actividad**. De ambas cosas se encarga `backup.yml`, semanal. Ver §14.
