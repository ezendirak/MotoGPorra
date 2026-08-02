# MotoGPorra — Diseño y diario del proyecto

> **Qué es este documento.** El registro vivo: qué se ha hecho, por qué se decidió así y qué queda pendiente. Se actualiza cada sesión.
>
> Las **reglas estables** —stack, convenciones, comandos, trampas conocidas— están en [CLAUDE.md](../CLAUDE.md), que se carga en contexto automáticamente. Si algo deja de cambiar, muévelo allí.

---

## Estado actual

**Última actualización: 02/08/2026.**

| Fase | Estado | Comprobado con |
|---|---|---|
| 0 — Fundación | ✅ | CI en verde |
| 1 — Base de datos | ✅ | `npm run db:verify` → 25/25 |
| 2 — Autenticación | ✅ | registro y login reales |
| 3 — Shell y calendario | ✅ | build + rutas protegidas |
| 4 — Apuestas | ✅ | apuesta real creada y puntuada |
| 5 — Resultados y puntuación | ✅ | prueba en Mugello: podio real, `breakdown` correcto |
| 6 — Clasificación | 🔶 | funciona; falta evolución y realtime |
| 7a — Ampliar librería | ✅ | 66 tests |
| 7b — Sincronizador | ✅ | temporada 2026 completa, 0 discrepancias, ejecutado en Actions |
| 8 — Administración | ❌ | — |
| 9 — PWA | 🔶 | manifest, iconos y service worker verificados con `next start`; falta instalarla en un móvil real |
| 10 — Producción | ❌ | — |

Datos cargados: 22 circuitos, 22 GP, 177 sesiones, 44 carreras apostables, 29 pilotos (22 activos), 22 resultados oficiales y 476 líneas de clasificación.

### Lo siguiente, por orden de valor

1. **Despliegue en Vercel (fase 10).** *Root Directory* = `apps/web`. Añadir variables de entorno y, en Supabase, la URL de producción a *Redirect URLs*. Sin esto la porra solo existe en `localhost` — y una PWA **no se puede instalar sin HTTPS**, así que la fase 9 no se cierra del todo hasta que esto esté hecho.
2. **Administración (fase 8).** Disparo manual del sync vía `workflow_dispatch` y apertura/cierre excepcional — el mecanismo `status_override` ya está probado.
3. **Cuenta atrás en vivo.** Hoy el tiempo restante se calcula en servidor y no avanza hasta recargar.

### Deuda y cosas a vigilar

- **SMTP.** El integrado de Supabase envía ~2-3 correos/hora. Antes de invitar a nadie hay que configurar uno propio (Resend tiene plan gratuito), o los registros fallarán en silencio.
- **3 vulnerabilidades `high`** en dependencias transitivas de Next.js (`postcss`, `sharp`). No hay versión que las resuelva hoy; `npm audit fix --force` degradaría el framework.
- **El cron automático nunca se ha disparado solo.** La ejecución manual del 02/08 funcionó; el primer `schedule` es el lunes 04:00 UTC.
- **La PWA no se ha instalado nunca en un móvil de verdad.** El manifest, los iconos y el service worker están verificados sirviendo desde `next start`, pero el navegador exige HTTPS para instalar: hasta que no haya despliegue no se sabe si el icono se ve bien en una pantalla de inicio ni si el prompt de iOS sale donde debe.

---

## Decisiones cerradas

| # | Decisión | Consecuencia en el diseño |
|---|---|---|
| 1 | **Solo MotoGP.** Moto2/Moto3 más adelante | El esquema mantiene `categories`; el sync y la UI filtran a MotoGP. Añadir categorías después es configuración, no migración |
| 2 | **Sí se apuesta al Sprint** | Un GP genera **dos** carreras apostables (`SPR` y `RAC`). Ver §1.3 y §4.4 |
| 3 | **Cierre 15 min antes de FP1** | Único cierre por GP: ambas apuestas (sprint y carrera) cierran a la vez, antes de FP1 |
| 4 | **Los empates se comparten** | `rank()` sobre puntos; sin criterios de desempate. Se muestra la misma posición |
| 5 | **Registro abierto** | Sin invitaciones ni aprobación. Landing → login o alta |
| 6 | **`get_riders` solo da la temporada actual** | El histórico se construye por **acumulación**: cada temporada deja su snapshot en `rider_season_entries` y jamás se borra. No es reconstruible hacia atrás |
| 7 | **Monorepo** con `motogp_client` dentro | Un solo repo → `workflow_dispatch` basta para el sync manual, sin `repository_dispatch` entre repos |
| 8 | **El sprint puntúa igual que la carrera**: 1 punto por acierto | `scoring_rules` sin multiplicador por `kind`. Máximo 6 puntos por GP |
| 9 | **Se amplía `motogp-client`** (§13) como fase 7a | El sincronizador no accederá nunca a atributos privados de la librería |
| 10 | **Service worker propio, sin Serwist** | Ver §14. Turbopack se queda; no hay paso de build extra ni dependencias nuevas. A cambio, las estrategias de caché se escriben a mano en `public/sw.js` |
| 11 | **No se cachea nada autenticado** | Toda la app pasa por `requireUser()`, así que su HTML y sus cargas RSC son distintas por usuario. El worker solo guarda `/_next/static/*` e `/icons/*`. Sin conexión no hay app: hay una página de aviso |

### Verificación contra la API real

El diseño inicial se escribió sobre los modelos Pydantic de la librería. Al contrastarlo con respuestas reales (temporada 2026, 22 GP, 29 pilotos, resultados hasta la ronda 11) aparecieron **seis discrepancias que obligan a corregir el esquema**; están marcadas con ⚠️ a lo largo del documento y resumidas en §13.

La más grave: **los UUID de piloto del endpoint de resultados y los del endpoint de pilotos son espacios distintos.** Sin corregirlo, ningún resultado casaría con ningún piloto y la puntuación no funcionaría.

---

## 0. Resumen ejecutivo

Aplicación web PWA Mobile First para gestionar una porra anual de MotoGP: cada usuario predice el podio (1º, 2º, 3º) de cada Gran Premio antes de que empiecen los entrenamientos oficiales. Al terminar la carrera, un servicio de sincronización importa el resultado oficial mediante la librería Python `motogp-client` y recalcula puntuaciones y clasificación de forma automática.

**Principio arquitectónico rector:** el frontend es *read-mostly* sobre Supabase. Todo dato deportivo entra por un único camino (el sincronizador), y toda escritura de usuario está limitada a su propia apuesta y su propio perfil, validada en servidor. No hay ninguna ruta en la que Next.js hable con MotoGP.

---

## 1. Modelo de dominio

### 1.1 Entidades

| Entidad | Descripción | Origen del dato |
|---|---|---|
| **Season** | Temporada deportiva (2026, 2027…). Raíz de todo el particionado temporal. | Sync |
| **Category** | Categoría deportiva (MotoGP, Moto2, Moto3, MotoE). | Sync / seed |
| **Circuit** | Circuito físico. Estable entre temporadas. | Sync |
| **Event** | Gran Premio: contenedor de sesiones dentro de una temporada. | Sync |
| **Session** | Sesión concreta de un evento y categoría (FP1, PR, FP2, Q1, Q2, SPR, WUP, RAC). | Sync |
| **Race** | Proyección de una sesión **apostable** (`SPR` o `RAC`). Unidad sobre la que se apuesta y se puntúa. | Derivado |
| **Team** | Equipo. Estable entre temporadas. | Sync |
| **Rider** | Identidad del piloto, estable de por vida. | Sync |
| **RiderSeasonEntry** | Inscripción de un piloto en una temporada+categoría, con equipo, dorsal y constructor. | Sync |
| **Profile** | Datos públicos del usuario (nombre, avatar). Extiende `auth.users`. | Usuario |
| **UserRole** | Rol de aplicación (`admin`, `player`). | Admin |
| **Bet** | Apuesta de un usuario para una carrera. | Usuario |
| **BetPick** | Selección concreta: posición (1/2/3) + piloto. Hija de `Bet`. | Usuario |
| **RaceResult** | Cabecera del resultado oficial importado. | Sync |
| **RaceResultEntry** | Fila del resultado: posición, piloto, estado (finished, DNF, DNS, DSQ). | Sync |
| **RaceScore** | Puntuación materializada de un usuario en una carrera. | Sistema |
| **SeasonStanding** | Clasificación general (vista derivada de `RaceScore`). | Derivado |
| **ScoringRule** | Configuración de puntuación por temporada. | Admin |
| **SyncRun** | Auditoría de cada ejecución del sincronizador. | Sync |

### 1.2 Invariantes de dominio

1. Un usuario tiene **como máximo una apuesta por carrera** (una para el sprint y otra para la carrera del domingo son apuestas distintas).
2. Una apuesta tiene **exactamente 3 picks**, en posiciones 1, 2 y 3, **sin pilotos repetidos**.
3. Los pilotos elegidos deben estar **inscritos en la temporada y categoría de esa carrera**.
4. Una apuesta solo es creable o modificable mientras la carrera esté en estado `open`.
5. Una apuesta ajena solo es visible **después** del cierre de apuestas de esa carrera.
6. La puntuación de una carrera solo existe si existe resultado oficial (`race_results.status = 'official'`).
7. `motogp_*_id` es único por entidad y es la clave de reconciliación del sincronizador.

### 1.3 Justificación de decisiones

- **`Rider` separado de `RiderSeasonEntry`.** Un piloto cambia de equipo, dorsal y hasta de categoría entre temporadas. Si guardáramos el equipo en `riders`, perderíamos el histórico al sincronizar 2027. Separar identidad estable de inscripción anual es lo que permite consultar "la apuesta de 2026 con el equipo que tenía entonces".
- **`Event` separado de `Session`.** El cierre de apuestas se calcula a partir de la **primera sesión oficial** del evento (FP1), no a partir de la carrera. Sin `Session` no podríamos derivar esa fecha y tendríamos que introducirla a mano — algo explícitamente descartado. Verificado: `GET /v1/results/sessions` devuelve las 8 sesiones del GP con su `date` **en UTC**, mientras que `date_start` del evento es solo el arranque del fin de semana (jueves 08:00 local) y no sirve para el cierre.
- **`Race` como proyección de una sesión apostable.** Toda la lógica de porra (apuestas, resultados, puntos) cuelga de una única entidad. Con el sprint confirmado (decisión 2), un GP produce **dos** filas en `races`: una para `SPR` y otra para `RAC`, ambas con el mismo `betting_closes_at`. El modelo de apuestas no cambia en absoluto: `bets` sigue colgando de `race_id`.
- **Un único cierre por GP, no uno por sesión.** Cerrar el sprint el sábado y la carrera el domingo daría al apostante información de la clasificación. Cerrando ambas antes de FP1 se apuesta a ciegas, que es lo que hace justa la porra.
- **`BetPick` como tabla hija y no tres columnas `p1/p2/p3`.** Tres columnas son más simples hoy, pero si mañana la porra pasa a top-5, a "piloto que abandona" o a puntuación ponderada por posición, habría que migrar tabla y toda la lógica. La tabla hija cuesta un `join` y nos deja el formato abierto.
- **`ScoringRule` por temporada.** Hoy es "1 punto por acierto exacto". Externalizarlo evita que la regla quede incrustada en una función SQL imposible de cambiar sin migración.
- **Estado de la carrera derivado, no escrito a mano.** Ver §4.6.

---

## 2. Arquitectura completa del sistema

```
┌──────────────────────────────────────────────────────────────────────┐
│                            NAVEGADOR (PWA)                            │
│  Next.js App Router · React Server Components · Tailwind · Serwist    │
└───────────────┬──────────────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼──────────────────────────────────────────────────────┐
│                        VERCEL — Next.js (App Router)                  │
│                                                                       │
│  Server Components  ──► @supabase/ssr (cliente SERVER, cookie-based)  │
│  Server Actions     ──► RPC transaccionales (place_bet…)              │
│  Route Handlers     ──► /api/admin/sync  (dispara el sincronizador)   │
│  Client Components  ──► @supabase/ssr (cliente BROWSER) sólo realtime │
│                          y formularios interactivos                   │
└───────────────┬──────────────────────────────────────────────────────┘
                │ PostgREST / Realtime  (JWT de usuario, RLS aplicada)
┌───────────────▼──────────────────────────────────────────────────────┐
│                              SUPABASE                                 │
│   Auth  ·  PostgreSQL + RLS  ·  Storage (avatares)  ·  Realtime       │
│   Funciones SQL: place_bet, recalculate_race_scores, is_admin…        │
└───────────────▲──────────────────────────────────────────────────────┘
                │ Conexión directa (service_role / Postgres) — bypass RLS
┌───────────────┴──────────────────────────────────────────────────────┐
│                    SERVICIO DE SINCRONIZACIÓN (Python)                │
│   Orquestador  ──►  motogp-client (librería existente, sin tocar)     │
│   Mappers MotoGP → esquema propio · Upserts idempotentes · SyncRun    │
└───────────────┬──────────────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼──────────────────────────────────────────────────────┐
│                   API privada de MotoGP (PulseLive)                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.1 Reglas de frontera

| Frontera | Permitido | Prohibido |
|---|---|---|
| Navegador → Supabase | Lectura con RLS, realtime | Escritura directa en tablas deportivas |
| Next.js server → Supabase | Lectura + RPC con JWT del usuario | Uso de `service_role` salvo en el módulo admin aislado |
| Next.js → MotoGP | — | **Todo**. No existe cliente HTTP a MotoGP en el repo web |
| Python → Supabase | Escritura completa (`service_role`) | Servir tráfico de usuario final |
| Python → MotoGP | Sólo a través de `motogp-client` | Llamadas HTTP propias |

### 2.2 Justificación

- **Sin backend intermedio propio.** Supabase ya es el backend: PostgREST + RLS + Auth. Añadir una API Node entre Next.js y Postgres duplicaría el modelo de permisos. La lógica que no cabe en RLS (crear apuesta atómicamente, recalcular puntos) vive en funciones SQL, que son transaccionales por definición.
- **Sin Redux.** El estado del servidor lo gestionan los Server Components y el cache de Next.js; el estado de UI es local. No hay estado global compartido que justifique un store.
- **`service_role` confinado.** La clave de servicio sólo existe en (a) el entorno del sincronizador y (b) un único módulo server-only de Next.js para acciones de administración. Nunca en el bundle de cliente.
- **Realtime como mejora, no como base.** La clasificación se renderiza en servidor; Realtime sólo empuja invalidaciones para que la tabla se refresque sola tras un sync. Si Realtime falla, la app sigue funcionando.

---

## 3. Comunicación entre piezas

### 3.1 Frontend ↔ Supabase

Tres clientes distintos, un único módulo de acceso (`lib/supabase/`):

| Cliente | Contexto | Credencial | Uso |
|---|---|---|---|
| `createServerClient()` | RSC, Server Actions, Route Handlers | JWT del usuario en cookie | Todas las lecturas y RPC |
| `createBrowserClient()` | Client Components | JWT del usuario | Realtime, subida de avatar |
| `createAdminClient()` | Sólo módulos `server-only` | `SUPABASE_SERVICE_ROLE_KEY` | Gestión de usuarios, disparo de sync |
| `proxy.ts` | Node | refresh de sesión | Renovar cookies, proteger rutas |

> ⚠️ **Next.js 16 renombra `middleware` a `proxy`** y **el runtime `edge` ya no está soportado ahí**: `proxy.ts` corre siempre en Node y no es configurable. El diseño original preveía Edge; no cambia nada funcionalmente (el refresco de sesión de Supabase funciona igual), pero sí el nombre del fichero y el de la función exportada.

**Ningún componente importa `@supabase/supabase-js` directamente.** Los componentes consumen `services/*`, que son funciones tipadas (`getUpcomingRaces(seasonId)`, `getStandings(seasonId)`) que encapsulan la query. Así, cambiar una query no obliga a tocar la UI y el tipado fluye desde los tipos generados de la base de datos.

### 3.2 Frontend ↔ Servicio Python

**No hay comunicación directa.** El único punto de contacto es el disparo manual del administrador:

```
Admin (UI) → Server Action → verifica rol admin
           → POST GitHub API workflow_dispatch  (mismo repo: decisión 7)
                 /repos/{owner}/{repo}/actions/workflows/sync-{job}.yml/dispatches
           → GitHub Actions ejecuta el sincronizador
           → el sincronizador escribe en Supabase y registra en `sync_runs`
           → la UI de admin lee `sync_runs` (polling/realtime) para mostrar el progreso
```

> Al ser monorepo (decisión 7), basta `workflow_dispatch` sobre el propio repositorio. `repository_dispatch` solo haría falta para disparar workflows de un repo distinto, y añade un tipo de evento que hay que enrutar a mano.

La UI **nunca espera** al sincronizador de forma síncrona: dispara y observa `sync_runs`. Esto evita timeouts de función serverless y hace el sistema tolerante a syncs largos.

### 3.3 Python ↔ Supabase

El sincronizador usa `service_role` y por tanto **bypassa RLS**. Dos opciones:

- **A) SDK `supabase-py`** sobre PostgREST. Sencillo, sin gestionar conexiones. Los upserts por lote van bien hasta unos miles de filas.
- **B) Conexión Postgres directa** (`psycopg` + pooler de Supabase). Permite transacciones multi-tabla reales, `COPY` y llamar a funciones SQL con control fino.

**Recomendación original:** B (`psycopg` contra el pooler en modo `session`), por la atomicidad.

> ⚠️ **Decisión revisada durante la implementación: se usa A (PostgREST).**
>
> **Motivo:** Supabase solo publica un registro **AAAA** para el host directo (`db.<ref>.supabase.co`) y la red de desarrollo no tiene ruta IPv6 — `Test-NetConnection` falla y Node ni siquiera resuelve el nombre. Los endpoints de pooler de la región del proyecto (`eu-central-1`) responden `tenant/user not found`, así que tampoco hay una cadena de conexión alcanzable por IPv4. PostgREST viaja por HTTPS y funciona desde cualquier red.
>
> **Coste asumido:** cada llamada es su propia transacción, luego un job no puede ser atómico de extremo a extremo. Si el proceso muere a mitad de una importación, quedan datos parcialmente escritos.
>
> **Cómo se compensa:** todos los jobs son **idempotentes** — upserts por `motogp_*_id` y reemplazo completo de colecciones —, de modo que una ejecución interrumpida se arregla repitiéndola. No es equivalente a una transacción, pero cubre el caso real: aquí no hay escrituras que dejen el sistema en un estado inconsistente *observable*, porque las puntuaciones se recalculan con `recalculate_race_scores` **después** de que las entradas del resultado estén completas, y esa función sí es atómica por ser una única sentencia SQL.
>
> **Cuándo revisarlo:** si en el futuro se ejecuta el sync desde un entorno con IPv6 (GitHub Actions lo tiene), se puede migrar a `psycopg` cambiando únicamente `apps/sync/db.py`. Los jobs y los mappers no se enteran.

### 3.4 Contrato de datos

El sincronizador es el **único** que conoce el formato de MotoGP. Traduce a nuestro esquema en una capa de *mappers* explícita. Si MotoGP cambia un campo, el radio de cambio es un mapper; el esquema propio y el frontend no se enteran.

---

## 4. Esquema de base de datos (PostgreSQL)

> Convenciones: `snake_case`; PK `uuid` con `gen_random_uuid()` salvo catálogos pequeños; `created_at`/`updated_at` en todas las tablas con trigger; los `motogp_*_id` se guardan como `text` (PulseLive usa UUIDs y slugs, no enteros).

### 4.1 Esquemas

- `public` — tablas expuestas vía PostgREST (RLS activada en **todas**).
- `internal` — funciones auxiliares, tablas de auditoría del sync. No expuesto.

### 4.2 Enumerados

```sql
create type race_status      as enum ('upcoming','open','closed','finished','cancelled');
create type session_kind     as enum ('fp','practice','qualifying','sprint','race','warmup','other');
create type result_status    as enum ('provisional','official');
create type app_role         as enum ('admin','player');
create type sync_job         as enum ('calendar','riders','results','full','recalculate');
create type sync_state       as enum ('running','success','failed','partial');
```

### 4.3 Catálogo deportivo

```sql
-- Temporadas
create table seasons (
  id            uuid primary key default gen_random_uuid(),
  year          smallint not null unique check (year between 1949 and 2100),
  name          text not null,
  starts_on     date,
  ends_on       date,
  is_active     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Sólo una temporada activa a la vez
create unique index seasons_single_active_idx on seasons (is_active) where is_active;

-- Categorías (MotoGP, Moto2, Moto3, MotoE)
create table categories (
  id                  uuid primary key default gen_random_uuid(),
  motogp_category_id  text unique,
  code                text not null unique,          -- 'MOTOGP'
  name                text not null,                 -- 'MotoGP'
  sort_order          smallint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Circuitos  ⚠️ el objeto `circuit` del calendario es mucho más rico de lo modelado
-- en la librería: trae iso_code, country, city, lat/lng, capacidad y el SVG del trazado.
create table circuits (
  id                    uuid primary key default gen_random_uuid(),
  motogp_circuit_id     text unique,                -- circuit.id (espacio del calendario)
  motogp_circuit_uuid   text unique,                -- 'results-api-circuit-uuid'
  name                  text not null,              -- 'Chang International Circuit'
  country_code          char(2),                    -- circuit.iso_code → 'TH'
  country_name          text,                       -- circuit.country → 'Thailand'
  city                  text,
  latitude              numeric(9,6),
  longitude             numeric(9,6),
  length_meters         integer,                    -- circuit.track.lenght
  left_corners          smallint,
  right_corners         smallint,
  layout_svg_url        text,                       -- circuit.track.assets.info.path
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index circuits_country_idx on circuits (country_code);

-- Grandes Premios
create table events (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references seasons(id)  on delete cascade,
  circuit_id        uuid          references circuits(id) on delete set null,
  motogp_event_id   text not null,                  -- Event.id del calendario
  motogp_event_uuid text,                           -- 'results-api-event-uuid'
  name              text not null,                  -- 'PT GRAND PRIX OF THAILAND'
  short_name        text,                           -- 'THA'
  round             smallint,                       -- ⚠️ Event.raw['sequence'] (campo REAL)
  country_code      char(2),                        -- Event.country → 'TH'
  starts_at         timestamptz,                    -- date_start (jueves 08:00 local)
  ends_at           timestamptz,                    -- date_end   (domingo 18:00 local)
  time_zone         text,                           -- 'ASIA/BANGKOK' → normalizar a IANA
  has_results       boolean not null default false,
  is_cancelled      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint events_motogp_uk unique (season_id, motogp_event_id)
);
create index events_season_round_idx on events (season_id, round);
create index events_starts_at_idx    on events (starts_at);

-- Sesiones del GP (las 8: FP1, PR, FP2, Q1, Q2, SPR, WUP, RAC)
create table sessions (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references events(id)     on delete cascade,
  category_id        uuid not null references categories(id) on delete restrict,
  motogp_session_id  text not null,
  type_code          text not null,                 -- ⚠️ 'FP','PR','Q','SPR','WUP','RAC'
  number             smallint,                      -- ⚠️ 1 ó 2 para FP y Q; null para el resto
  code               text generated always as       -- 'FP1','FP2','Q1','Q2','SPR','RAC'
                       (type_code || coalesce(number::text,'')) stored,
  kind               session_kind not null,
  scheduled_at       timestamptz,                   -- ⚠️ session.date, YA en UTC
  is_bettable        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint sessions_motogp_uk unique (motogp_session_id)
);
create index sessions_event_cat_idx  on sessions (event_id, category_id);
create index sessions_scheduled_idx  on sessions (scheduled_at);
```

### 4.4 Carreras (unidad de porra)

Con el sprint confirmado (decisión 2), un GP genera **dos** filas: `kind = 'sprint'` y `kind = 'race'`.

```sql
create table races (
  id                    uuid primary key default gen_random_uuid(),
  season_id             uuid not null references seasons(id)    on delete cascade,
  event_id              uuid not null references events(id)     on delete cascade,
  category_id           uuid not null references categories(id) on delete restrict,
  session_id            uuid          references sessions(id)   on delete set null,
  kind                  session_kind not null check (kind in ('sprint','race')),

  -- Programación
  scheduled_at          timestamptz,                -- hora oficial de la sesión (UTC)
  betting_closes_at     timestamptz,                -- calculado por el sync (ver 4.6)
  betting_closes_at_override timestamptz,           -- excepción del administrador
  closes_at             timestamptz generated always as
                          (coalesce(betting_closes_at_override, betting_closes_at)) stored,

  -- Estado
  status_override       race_status,                -- fuerza el estado (admin)
  is_cancelled          boolean not null default false,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint races_event_category_kind_uk unique (event_id, category_id, kind)
);
create index races_season_sched_idx on races (season_id, scheduled_at);
create index races_closes_at_idx    on races (closes_at);
```

> **Puntuación separada.** Sprint y carrera puntúan por separado y ambas suman a la misma clasificación general. Si más adelante se quiere que el sprint valga menos, se añade un multiplicador a `scoring_rules` por `kind` — sin migración estructural.
>
> **No todos los GP tienen sprint** en todas las categorías (`event_categories[].sprint_num_laps` es `null` para Moto2/Moto3). El sync crea la fila `sprint` solo si existe la sesión `SPR`, así que la ausencia se resuelve sola.

### 4.5 Pilotos y equipos

```sql
create table constructors (
  id                     uuid primary key default gen_random_uuid(),
  motogp_constructor_id  text unique,
  motogp_legacy_id       integer unique,
  name                   text not null,             -- 'Honda', 'Ducati'
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table teams (
  id                uuid primary key default gen_random_uuid(),
  motogp_team_id    text unique,
  motogp_legacy_id  integer unique,
  constructor_id    uuid references constructors(id) on delete set null,
  name              text not null,                  -- 'Honda LCR'
  color             text,                           -- '#fafafa' — útil para la UI
  text_color        text,
  picture_url       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Identidad estable del piloto
create table riders (
  id                uuid primary key default gen_random_uuid(),
  motogp_rider_id   text    not null unique,        -- Rider.id de GET /riders
  motogp_legacy_id  integer unique,                 -- ⚠️ clave de reconciliación secundaria
  first_name        text,                           -- Rider.name
  last_name         text,                           -- Rider.surname
  full_name         text not null,                  -- ⚠️ ver nota: no siempre hay ambos
  nickname          text,
  country_code      char(2),                        -- Rider.country.iso
  country_name      text,
  birth_date        date,
  birth_city        text,
  start_year        smallint,
  is_retired        boolean not null default false,
  photo_url         text,                           -- ⚠️ la API NO lo devuelve; nullable
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index riders_last_name_idx on riders (last_name);
create index riders_legacy_idx    on riders (motogp_legacy_id);

-- Inscripción por temporada + categoría  → histórico entre temporadas
create table rider_season_entries (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id)    on delete cascade,
  category_id   uuid not null references categories(id) on delete restrict,
  rider_id      uuid not null references riders(id)     on delete cascade,
  team_id       uuid          references teams(id)      on delete set null,
  sponsored_team text,                                -- 'CASTROL Honda LCR'
  number        smallint check (number between 0 and 999),
  is_active     boolean not null default true,        -- false si deja de competir
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint rse_uk unique (season_id, category_id, rider_id)
);
create index rse_lookup_idx on rider_season_entries (season_id, category_id) where is_active;
```

> ⚠️ **`full_name` no puede ser columna generada.** El diseño inicial la calculaba como `first_name || ' ' || last_name`, pero ambos campos son opcionales en la API y `||` con un `NULL` da `NULL`. Se guarda el valor ya compuesto por el mapper (`Rider.full_name` de la librería, que hace el join tolerante).
>
> ⚠️ **`photo_url` no existe en la API.** Los campos extra reales de `Rider` son `birth_city`, `birth_date`, `famous_attributes`, `published`, `retired`, `retired_year`, `start_year`, `years_old`. La columna queda nullable y la UI cae en un avatar con el dorsal — que además es más reconocible que una foto en miniatura.
>
> **`GET /riders` devolvió 29 pilotos para MotoGP 2026**, no 22: incluye retirados y sustitutos. El sync marca `is_active = (current_career_step.current and not retired)`; el selector de apuesta usa el índice parcial `rse_lookup_idx`, así que los inactivos ni aparecen ni estorban.
>
> **`constructors` como tabla propia** en vez de texto libre: viene con `id` y `legacy_id` estables, y habilita estadísticas por marca sin normalizar cadenas a posteriori.

### 4.6 Cálculo automático del estado y del cierre

`betting_closes_at` lo escribe el sincronizador como **`scheduled_at` de la primera sesión del evento para esa categoría** (que es FP1 por definición cronológica), menos 15 minutos:

```sql
-- Ejecutado por el sync tras importar sesiones.
-- Afecta por igual a la fila 'sprint' y a la 'race' del mismo GP (decisión 3).
update races r
set betting_closes_at = s.first_session_at - interval '15 minutes'
from (
  select event_id, category_id, min(scheduled_at) as first_session_at
  from sessions
  where scheduled_at is not null
  group by event_id, category_id
) s
where r.event_id = s.event_id
  and r.category_id = s.category_id
  and r.betting_closes_at is distinct from s.first_session_at - interval '15 minutes';
```

> **`min(scheduled_at)` en vez de filtrar por `code = 'FP1'`.** Es inmune a cambios de formato de fin de semana: si MotoGP renombra las sesiones o añade una previa, "la primera del fin de semana" sigue siendo correcta. Filtrar por código exacto se rompería en silencio y las apuestas quedarían abiertas de más.
>
> Verificado: para Tailandia 2026, FP1 es `2026-02-27T10:45:00+00:00` → cierre a las `10:30 UTC`. Las fechas de sesión llegan **ya en UTC**, así que no hay conversión de zona horaria que pueda salir mal. La UI sí convierte a hora local del usuario para mostrarla.

El **estado no se almacena**: se deriva en una vista, de modo que nunca puede quedar obsoleto por falta de un cron.

```sql
create view races_view as
select r.*,
       e.name as event_name, e.round,
       c.name as circuit_name, c.country_code, c.country_name,
       cat.code as category_code,
       coalesce(
         r.status_override,
         case
           when r.is_cancelled                              then 'cancelled'
           when res.id is not null and res.status='official' then 'finished'
           when now() >= r.closes_at                         then 'closed'
           when now() >= (r.closes_at - interval '14 days')  then 'open'
           else 'upcoming'
         end::race_status
       ) as status
from races r
join events e     on e.id = r.event_id
join categories cat on cat.id = r.category_id
left join circuits c on c.id = e.circuit_id
left join race_results res on res.race_id = r.id;
```

> **Decisión.** La alternativa (una columna `status` actualizada por cron) introduce una ventana en la que la base de datos miente: si el cron falla, las apuestas siguen abiertas después del cierre. Derivar el estado hace que la regla sea inviolable — y las políticas RLS usan `now() < closes_at` directamente, no la columna. `status_override` cubre el caso "abrir/cerrar excepcionalmente" que pide el administrador.

### 4.7 Usuarios, perfiles y roles

```sql
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index profiles_display_name_uk on profiles (lower(display_name));

create table user_roles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  role     app_role not null default 'player',
  created_at timestamptz not null default now()
);

-- Participación en la porra de una temporada (permite altas/bajas por año)
create table season_participants (
  season_id  uuid not null references seasons(id)     on delete cascade,
  user_id    uuid not null references auth.users(id)  on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (season_id, user_id)
);
```

> El **email no se duplica** en `profiles`: vive en `auth.users` y se lee de la sesión. Duplicarlo obligaría a sincronizarlo en cada cambio y lo expondría vía PostgREST.

### 4.8 Apuestas

```sql
create table bets (
  id          uuid primary key default gen_random_uuid(),
  race_id     uuid not null references races(id)      on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint bets_user_race_uk unique (user_id, race_id)   -- una apuesta por carrera
);
create index bets_race_idx on bets (race_id);
create index bets_user_idx on bets (user_id);

create table bet_picks (
  bet_id    uuid     not null references bets(id)   on delete cascade,
  position  smallint not null check (position between 1 and 3),
  rider_id  uuid     not null references riders(id) on delete restrict,
  primary key (bet_id, position),
  constraint bet_picks_no_duplicate_rider unique (bet_id, rider_id)  -- sin repetidos
);
create index bet_picks_rider_idx on bet_picks (rider_id);
```

La regla "exactamente 3 picks" y "pilotos inscritos en esa temporada/categoría" se garantizan en la función `place_bet` (§8), que es el **único** camino de escritura.

### 4.9 Resultados

```sql
create table race_results (
  id            uuid primary key default gen_random_uuid(),
  race_id       uuid not null unique references races(id) on delete cascade,
  status        result_status not null default 'provisional',
  imported_at   timestamptz not null default now(),
  source        text not null default 'motogp-client',
  raw_payload   jsonb,                          -- respuesta original, para auditoría
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table race_result_entries (
  id             uuid primary key default gen_random_uuid(),
  race_result_id uuid not null references race_results(id) on delete cascade,
  rider_id       uuid not null references riders(id)       on delete restrict,
  position       smallint check (position >= 1),           -- ⚠️ null si no clasificado
  is_classified  boolean not null default true,            -- status == 'INSTND'
  status_raw     text,                                     -- 'INSTND' | 'OUTSTND'
  total_time     text,                                     -- ⚠️ '40:53.148' (texto)
  gap_to_first   text,                                     -- ⚠️ '0.000' | '1.996'
  gap_laps       text,                                     -- gap.lap si se retiró
  championship_points numeric(5,2),                        -- ⚠️ la API devuelve float
  team_name      text,                                     -- ⚠️ texto plano, no relación
  constructor_id uuid references constructors(id) on delete set null,
  number         smallint,
  constraint rre_result_rider_uk unique (race_result_id, rider_id)
);
create unique index rre_position_uk
  on race_result_entries (race_result_id, position) where position is not null;
```

> ⚠️ **El enum `finish_status` desaparece.** La API solo distingue `INSTND` (clasificado) y `OUTSTND` (no clasificado): **no diferencia DNF, DNS ni DSQ**. Inventar un enum de cinco valores que nunca se podrían rellenar sería mentir en el esquema. Se guarda el booleano real y el código crudo.
>
> ⚠️ **Tiempos como texto.** La API devuelve `time: '40:53.148'` y `gap.first: '0.000'` como cadenas. Convertirlas a milisegundos es una decisión de presentación que no aporta nada aquí: nunca ordenamos por tiempo, ordenamos por `position`. Guardar el original evita errores de parseo con formatos irregulares (vueltas de retraso, líder sin gap).
>
> ⚠️ **`team_name` es texto plano** en la clasificación (`'Ducati Lenovo Team'`), distinto del nombre del equipo en `/riders` (`'Honda LCR'`) y del patrocinado (`'CASTROL Honda LCR'`). No se intenta casar con `teams`: se guarda tal cual como dato histórico del resultado. El equipo "de verdad" del piloto ya está en `rider_season_entries`.
>
> Guardamos el **resultado completo**, no solo el podio (verificado: 22 clasificados + 5 fuera en Alemania). Cuesta lo mismo y habilita futuras modalidades sin re-importar. `raw_payload` permite reprocesar sin volver a llamar a MotoGP.

### 4.10 Puntuación y clasificación

```sql
create table scoring_rules (
  id                 uuid primary key default gen_random_uuid(),
  season_id          uuid not null references seasons(id) on delete cascade,
  points_exact_position smallint not null default 1,   -- acierto de posición exacta
  points_podium_any     smallint not null default 0,   -- piloto en podio, otra posición
  created_at         timestamptz not null default now(),
  constraint scoring_rules_season_uk unique (season_id)
);

create table race_scores (
  race_id     uuid not null references races(id)      on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  points      smallint not null default 0 check (points >= 0),
  exact_hits  smallint not null default 0,
  breakdown   jsonb not null default '{}'::jsonb,   -- {"1":true,"2":false,"3":true}
  computed_at timestamptz not null default now(),
  primary key (race_id, user_id)
);
create index race_scores_user_idx on race_scores (user_id);

create view season_standings as
select
  r.season_id,
  s.user_id,
  p.display_name,
  p.avatar_url,
  sum(s.points)::int                       as total_points,
  sum(s.exact_hits)::int                   as total_exact_hits,
  count(*)::int                            as races_played,
  rank() over (partition by r.season_id order by sum(s.points) desc)  as position
from race_scores s
join races r    on r.id = s.race_id
join profiles p on p.id = s.user_id
group by r.season_id, s.user_id, p.display_name, p.avatar_url;
```

> **Vista, no tabla materializada.** Con ~20 usuarios × ~44 sesiones apostables (22 sprints + 22 carreras) son ~880 filas: el agregado es instantáneo y siempre coherente. Si el sistema creciera a miles de usuarios, se convierte en vista materializada refrescada al final del sync — cambio local, sin impacto en el frontend.
>
> **Empates compartidos (decisión 4).** `rank()` ya produce exactamente eso: dos usuarios con los mismos puntos comparten posición y la siguiente salta (1, 2, 2, 4). No hay criterio de desempate, así que no hay nada que configurar ni que explicar al usuario. `total_exact_hits` se muestra como dato informativo, no ordena.

### 4.11 Auditoría de sincronización

```sql
create table sync_runs (
  id            uuid primary key default gen_random_uuid(),
  job           sync_job not null,
  state         sync_state not null default 'running',
  season_id     uuid references seasons(id) on delete set null,
  triggered_by  uuid references auth.users(id) on delete set null,  -- null = automático
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  stats         jsonb not null default '{}'::jsonb,  -- {"events":22,"riders":44,...}
  error         text
);
create index sync_runs_started_idx on sync_runs (started_at desc);
```

---

## 5. Relaciones entre tablas

```
seasons ─┬─< events ─┬─< sessions >─ categories
         │           └─< races ──┬─< bets ──< bet_picks >── riders     (2 por GP: SPR + RAC)
         │                       ├─< race_results ──< race_result_entries >── riders
         │                       └─< race_scores >── auth.users
         ├─< rider_season_entries >── riders, teams, categories
         ├─< season_participants  >── auth.users
         └─< scoring_rules

circuits     ──< events
constructors ──< teams ──< rider_season_entries
auth.users ─┬── profiles (1:1)
            ├── user_roles (1:1)
            ├──< bets
            └──< race_scores
```

| Relación | Cardinalidad | `ON DELETE` | Motivo |
|---|---|---|---|
| `seasons` → `events` | 1:N | `cascade` | Borrar una temporada de prueba limpia todo |
| `events` → `races` | 1:2 | `cascade` | Sprint y carrera; una carrera no existe sin su GP |
| `races` → `bets` | 1:N | `cascade` | — |
| `bets` → `bet_picks` | 1:3 | `cascade` | Los picks no tienen vida propia |
| `riders` → `bet_picks` | 1:N | `restrict` | Nunca borrar un piloto apostado; se marca inactivo |
| `auth.users` → `profiles` | 1:1 | `cascade` | Borrar cuenta borra perfil (RGPD) |
| `auth.users` → `bets` | 1:N | `cascade` | Idem |
| `circuits` → `events` | 1:N | `set null` | El evento sobrevive a una limpieza de circuitos |

**Índices clave y su motivo**

| Índice | Consulta que sirve |
|---|---|
| `races_season_sched_idx` | "Próximas carreras de la temporada" — la home |
| `races_closes_at_idx` | Evaluación de estado y RLS temporal |
| `bets_user_race_uk` | Invariante 1 + carga de "mi apuesta" |
| `race_scores_user_idx` | Histórico personal |
| `rse_lookup_idx` (parcial) | Selector de pilotos del formulario de apuesta |
| `sessions_event_cat_idx` | Cálculo de `betting_closes_at` |
| `events_motogp_uk`, `sessions_motogp_uk`, `riders.motogp_rider_id` | Upserts del sincronizador |
| `riders_legacy_idx` | Respaldo de reconciliación de pilotos en resultados (§6.2.1) |

---

## 6. Estrategia de sincronización

### 6.1 Trabajos

| Job | Frecuencia | Fuente | Coste (peticiones) | Efecto |
|---|---|---|---|---|
| `calendar` | Semanal (lunes 04:00 UTC) + manual | `get_calendar_current()` + sesiones por evento | ~1 + 3×22 ≈ **67** | Upsert de `events`, `circuits`, `sessions`, `races`; recálculo de `betting_closes_at` |
| `riders` | Semanal (lunes 04:15 UTC) + manual | `get_riders("MotoGP")` | **1** | Upsert de `riders`, `constructors`, `teams`, `rider_season_entries` |
| `results` | Sáb. y dom. cada 30 min, 12:00–21:00 UTC + manual | `get_session_classification(session_id)` | **1 por sesión** | Upsert de `race_results`, entradas y **recálculo** |
| `backfill` | Manual / revisión por sanción | Igual, sin saltar las ya importadas | ~**44** | Reimportación completa de la temporada |

> ⚠️ **Optimización sobre el diseño original.** Se preveía usar
> `get_latest_race_results()` / `get_completed_race_results()`, que resuelven
> evento → categoría → sesión → clasificación: **4 peticiones por resultado**,
> ~176 para una temporada entera.
>
> Como el job `calendar` ya guarda los 177 `motogp_session_id`, el job de
> resultados pide la clasificación **directamente por UUID de sesión** con el
> nuevo método `get_session_classification()`. Una petición por resultado:
> ~44 para la temporada completa, y 1–2 en el cron del fin de semana.
| `recalculate` | Manual | — | 0 | Recalcula puntuaciones sin volver a llamar a MotoGP |

> ⚠️ **El coste no es despreciable y condiciona la frecuencia.** Cada resultado exige encadenar 4 llamadas (`events/{id}` → `results/categories` → `results/sessions` → `results/classifications`). `get_completed_race_results` recorre **las 22 rondas**: ~88 peticiones y decenas de segundos, medido en vivo. Por eso el cron dominical usa `get_latest_race_results`, que itera desde el final y **se detiene en la primera carrera con clasificación** (~4–8 peticiones), y el barrido completo queda como job manual `backfill`.
>
> **Calendario semanal, no diario.** El calendario cambia poquísimo; sondearlo cada día son ~470 peticiones semanales para nada. Semanal + botón manual cubre cualquier cambio de horario con margen de sobra, dado que el cierre es el viernes.
>
> **Sábado incluido** en el job `results`: con el sprint apostable (decisión 2), hay resultado que importar el sábado.

### 6.2 Algoritmo (job `results`)

```
1. INSERT sync_runs (job='results', state='running') → run_id
2. Con motogp_client: result = get_latest_race_results("MotoGP")
3. Localizar race por (season, motogp_event_id, kind)            ← nunca por nombre
4. Si ya existe race_results official con el mismo hash de payload → saltar
5. BEGIN
     upsert race_results (raw_payload = respuesta cruda)
     resolver rider_id de cada entrada  (ver 6.2.1)
     delete + insert race_result_entries      (reemplazo completo, idempotente)
     SELECT recalculate_race_scores(race_id)  (función SQL)
   COMMIT
6. UPDATE sync_runs SET state='success', stats={...}, finished_at=now()
   (en excepción: state='failed', error=traceback)
```

#### 6.2.1 ⚠️ Reconciliación de pilotos — el punto más frágil de todo el sistema

**Los UUID de piloto del endpoint de resultados NO son los del endpoint de pilotos.** Verificado en vivo con el podio del GP de Alemania 2026:

| Fuente | Campo | Marc Márquez |
|---|---|---|
| `GET /riders` | `id` | `23e50438-a657-4fb0-a190-3262b5472f29` |
| `GET /v2/results/classifications` | `rider.id` | `f55b433d-38b8-4d1d-bb3a-a709c82a0260` ❌ |
| `GET /v2/results/classifications` | `rider.riders_api_uuid` | `23e50438-a657-4fb0-a190-3262b5472f29` ✅ |
| Ambos | `legacy_id` | `7444` ✅ |

Casar por `rider.id` **no encontraría ningún piloto** y todas las puntuaciones saldrían a cero, en silencio. La cascada de resolución es:

```
1. riders.motogp_rider_id  = entry.rider.riders_api_uuid   ← camino normal
2. riders.motogp_legacy_id = entry.rider.legacy_id         ← respaldo
3. → error duro: abortar la carrera, sync_runs.state='partial', registrar el piloto
     sin resolver. NUNCA insertar un piloto a medias ni casar por nombre.
```

El paso 3 es deliberadamente ruidoso: un piloto sin resolver significa un podio potencialmente mal puntuado, y es preferible que el admin lo vea a que la clasificación mienta. `race_result_entries.rider_id` es `NOT NULL` con FK `restrict`, así que la base de datos también lo impide.

**Propiedades del algoritmo:**
- **Idempotente.** Reejecutar no duplica nada: todo es upsert por `motogp_*_id` y reemplazo total de entradas.
- **Atómico por carrera.** Un fallo en la carrera 7 no corrompe la 6.
- **Reconciliación por ID, jamás por nombre.** "Gran Premio de España" cambia de patrocinador; el `motogp_event_id` no. Y hay dos pilotos apellidados Márquez.
- **Orden obligatorio: `riders` antes que `results`.** Un piloto sustituto que debuta el mismo fin de semana no existiría al importar el resultado. El job `results` ejecuta primero un `riders` incremental.
- **Auditable.** `sync_runs` + `raw_payload` permiten reconstruir qué pasó y reprocesar sin volver a llamar a MotoGP.

### 6.3 Opciones de ejecución

| Opción | Ventajas | Inconvenientes | Veredicto |
|---|---|---|---|
| **GitHub Actions (`schedule` + `workflow_dispatch`)** | Gratis en repos públicos y con cuota amplia en privados; Python nativo; secretos gestionados; logs y reintentos incorporados; el disparo manual del admin es una llamada a la API de GitHub; **el monorepo ya contiene la librería, sin publicar paquete** (`pip install ./motogp_client`); sin infraestructura que mantener | Cron con retraso variable (hasta ~15 min en horas punta); los `schedule` se desactivan tras 60 días de inactividad en el repo; arranque en frío de ~30 s | ✅ **Recomendada** |
| **Vercel Cron** | Integrado con el despliegue existente; cron fiable | **No ejecuta Python.** Habría que reimplementar el cliente en TS (violando el requisito) o usarlo sólo como *disparador* HTTP hacia otro servicio; límite de duración en funciones serverless | ⚠️ Sólo como disparador |
| **Supabase Edge Functions + `pg_cron`** | Cron dentro de la propia base; máxima cercanía al dato | Deno/TypeScript: **no ejecuta Python**. `pg_cron` sí sirve para tareas SQL puras (recálculos) | ⚠️ Complementaria |
| **Cloud Run Jobs + Cloud Scheduler** | Contenedor Python real; cron preciso; escala a cero; timeouts largos | Otra nube más en el stack; requiere Dockerfile y IAM; coste pequeño pero no nulo | 🔷 Alternativa sólida si GH Actions se queda corto |
| **Fly.io / Railway worker** | Proceso persistente, cron interno, muy simple de desplegar | Cuesta dinero aunque esté ocioso 6 días a la semana; hay que vigilar el proceso | 🔷 Alternativa |
| **AWS Lambda + EventBridge** | Cron preciso, coste ~0, Python nativo | Empaquetado de dependencias (capas), más ceremonia IAM | 🔷 Alternativa |
| **Cron en máquina propia / NAS** | Control total, coste 0 | Punto único de fallo doméstico; sin observabilidad; el disparo manual desde la web se complica mucho | ❌ |

**Decisión propuesta:** **GitHub Actions** como ejecutor principal + **`pg_cron`** para el recálculo puramente SQL. El disparo manual del administrador se implementa con `repository_dispatch`. El retraso del cron de Actions es irrelevante aquí: los resultados no son un dato de tiempo real y la ventana de sondeo del domingo (cada 30 min) absorbe cualquier desfase. Si en el futuro se quisiera "resultado a los 2 minutos de bajar bandera", se migra el job `results` a Cloud Run Jobs sin tocar nada más — el sincronizador es el mismo contenedor.

### 6.4 Seguridad del sincronizador

- `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL` como secretos de GitHub, nunca en el repo web ni en variables `NEXT_PUBLIC_*`.
- El endpoint `/api/admin/sync` de Next.js valida rol `admin` **en servidor** antes de llamar a GitHub, y aplica rate limit (1 sync manual/minuto).
- El token de GitHub usado por Next.js es *fine-grained* con permiso único: `actions: write` sobre ese repo (lo que exige `workflow_dispatch`).
- **Rate limit hacia MotoGP.** Es una API privada y no documentada: el sincronizador respeta el `User-Agent` de la librería, mantiene los reintentos con backoff ya implementados y no paraleliza peticiones. El job `backfill` (~88 llamadas) es manual precisamente para que nadie lo programe cada 30 minutos.

---

## 7. Flujo de autenticación

### 7.1 Métodos

- **Email + contraseña** (principal), con verificación de email obligatoria.
- **Magic link** como recuperación alternativa.
- **Recuperación de contraseña** vía `resetPasswordForEmail` → página `/auth/reset`.
- OAuth (Google) queda contemplado pero fuera del alcance inicial: activarlo después no requiere cambios de esquema.

### 7.2 Registro

```
1. Usuario envía email + password + display_name  (Server Action)
2. supabase.auth.signUp({ email, password, options: { data: { display_name } } })
3. Supabase crea auth.users y envía email de confirmación
4. TRIGGER on auth.users AFTER INSERT → internal.handle_new_user():
     - INSERT profiles (id, display_name desde raw_user_meta_data)
     - INSERT user_roles (user_id, 'player')
     - INSERT season_participants (temporada activa, user_id)
5. Usuario confirma email → sesión activa
```

> El trigger garantiza que **nunca** existe un `auth.users` sin `profile` ni rol. Hacerlo desde el cliente dejaría usuarios a medio crear si el navegador se cierra entre ambas llamadas.
>
> **Registro abierto (decisión 5).** Sin invitaciones ni aprobación: la raíz `/` redirige a `/login`, con enlace a `/register`. El alta inscribe automáticamente en la temporada activa (paso 4). Si algún día se quisiera cerrar, `season_participants` ya es el punto de control natural — se dejaría de insertar en el trigger y pasaría a hacerlo el admin, sin tocar el esquema.
>
> **Verificación de email obligatoria** aunque el registro sea abierto: es lo único que impide que alguien ocupe el nombre de otro participante con un correo inventado.

### 7.3 Sesión

- Cookies HTTP-only gestionadas por `@supabase/ssr`.
- `proxy.ts` (antes `middleware.ts`) refresca el token en cada navegación y protege `/(app)` y `/admin`.
- ⚠️ `cookies()` y `headers()` son **asíncronas obligatoriamente** en Next.js 16; el acceso síncrono se eliminó. Toda creación de cliente Supabase de servidor será `await`.
- El JWT incluye el claim `app_role` inyectado por un **Custom Access Token Hook** de Supabase que lee `user_roles`. Así, las políticas RLS comprueban el rol leyendo el JWT en vez de hacer un `SELECT` a `user_roles` en cada fila.

```sql
-- Política de admin sin subconsulta por fila
create function internal.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'app_role', 'player') = 'admin';
$$;
```

> **Motivo.** La alternativa (`exists (select 1 from user_roles where ...)`) es correcta pero se evalúa por fila y, si `user_roles` tiene a su vez RLS, provoca recursión infinita — un fallo clásico de Supabase. El claim en el JWT lo elimina de raíz. Contrapartida: un cambio de rol no surte efecto hasta el siguiente refresco de token (≤1 h); aceptable, y forzable cerrando sesión.

### 7.4 Autorización en el frontend

Dos capas, ambas necesarias:
1. **UX:** el layout `/(admin)` comprueba el rol en el Server Component y hace `notFound()` si no procede.
2. **Seguridad real:** RLS en la base de datos. Aunque alguien llamara a la API directamente, no vería ni escribiría nada indebido.

---

## 8. Flujo de creación de apuestas

### 8.1 Recorrido de usuario

```
Home → tarjeta "Próxima carrera" con cuenta atrás hasta closes_at
     → /races/[id]/bet
        · Selector de pilotos: rider_season_entries de esa temporada+categoría
        · 3 slots (🥇🥈🥉); un piloto ya elegido se deshabilita en los otros slots
        · Si ya existe apuesta y la carrera está `open` → precargada y editable
        · Si `closed`/`finished` → sólo lectura + comparación con el resultado
     → Guardar (Server Action) → RPC place_bet → updateTag → confirmación
```

### 8.2 Escritura: una sola RPC transaccional

```sql
create function place_bet(p_race_id uuid, p_rider_ids uuid[])
returns uuid
language plpgsql
security invoker   -- respeta RLS: el usuario sólo puede tocar lo suyo
as $$
declare v_bet_id uuid; v_race races%rowtype;
begin
  -- 1. Autenticación
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  -- 2. Bloqueo de la carrera y validación de ventana temporal (fuente de verdad: el servidor)
  select * into v_race from races where id = p_race_id for share;
  if not found                                then raise exception 'RACE_NOT_FOUND'; end if;
  if v_race.is_cancelled                      then raise exception 'RACE_CANCELLED'; end if;
  if now() >= v_race.closes_at
     and coalesce(v_race.status_override,'x') <> 'open'
                                              then raise exception 'BETTING_CLOSED'; end if;

  -- 3. Validación de los picks
  if array_length(p_rider_ids,1) <> 3         then raise exception 'INVALID_PICK_COUNT'; end if;
  if (select count(distinct x) from unnest(p_rider_ids) x) <> 3
                                              then raise exception 'DUPLICATE_RIDER'; end if;
  if (select count(*) from rider_season_entries e
       where e.rider_id = any(p_rider_ids)
         and e.season_id = v_race.season_id
         and e.category_id = v_race.category_id
         and e.is_active) <> 3                then raise exception 'RIDER_NOT_IN_SEASON'; end if;

  -- 4. Upsert atómico
  insert into bets (race_id, user_id) values (p_race_id, auth.uid())
  on conflict (user_id, race_id) do update set updated_at = now()
  returning id into v_bet_id;

  delete from bet_picks where bet_id = v_bet_id;
  insert into bet_picks (bet_id, position, rider_id)
  select v_bet_id, ord, rid from unnest(p_rider_ids) with ordinality as t(rid, ord);

  return v_bet_id;
end $$;
```

### 8.3 Justificación

- **`now()` del servidor manda.** Un reloj de cliente adelantado no puede colar una apuesta tardía. La cuenta atrás de la UI es informativa; la verdad es esta función.
- **Una llamada, una transacción.** Con dos peticiones (`upsert bets` + `insert picks`) un fallo de red dejaría una apuesta con 0 o 1 picks — un estado que viola el invariante 2.
- **`security invoker`.** La función no eleva privilegios: RLS sigue aplicando y el usuario sigue sin poder escribir la apuesta de otro. Los errores son códigos estables (`BETTING_CLOSED`…) que la capa de servicios traduce a mensajes en castellano.
- **Optimistic UI en el cliente**, con reversión si la Server Action devuelve error — la interacción se siente instantánea sin sacrificar la validación.
- ⚠️ **`updateTag`, no `revalidateTag`.** Next.js 16 introduce `updateTag` con semántica *read-your-writes*: expira y refresca en la misma petición, así que el usuario ve su apuesta guardada de inmediato. `revalidateTag` (que además ahora **exige un segundo argumento** con el perfil de `cacheLife`) sirve contenido obsoleto mientras revalida — aceptable para el calendario, no para "acabo de guardar mi apuesta".

---

## 9. Flujo de cálculo de puntuaciones

### 9.1 Disparador

Se ejecuta **dentro de la misma transacción** que importa el resultado (§6.2), no por trigger de tabla. Motivo: un trigger se dispararía fila a fila durante la inserción de las ~22 entradas del resultado, recalculando 22 veces. Llamada explícita al final = un único cálculo sobre datos ya completos.

### 9.2 Función

```sql
create function recalculate_race_scores(p_race_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare v_rows integer; v_rules scoring_rules%rowtype;
begin
  select sr.* into v_rules
  from scoring_rules sr join races r on r.season_id = sr.season_id
  where r.id = p_race_id;

  -- Podio oficial (sólo entradas clasificadas)
  with podium as (
    select e.position, e.rider_id
    from race_result_entries e
    join race_results rr on rr.id = e.race_result_id
    where rr.race_id = p_race_id
      and rr.status  = 'official'
      and e.is_classified
      and e.position between 1 and 3
  ),
  scored as (
    select b.user_id,
           sum(case when p.rider_id is not null
                    then coalesce(v_rules.points_exact_position,1) else 0 end)::smallint as points,
           count(p.rider_id)::smallint as exact_hits,
           jsonb_object_agg(bp.position::text, p.rider_id is not null) as breakdown
    from bets b
    join bet_picks bp on bp.bet_id = b.id
    left join podium p on p.position = bp.position and p.rider_id = bp.rider_id
    where b.race_id = p_race_id
    group by b.user_id
  )
  insert into race_scores (race_id, user_id, points, exact_hits, breakdown, computed_at)
  select p_race_id, user_id, points, exact_hits, breakdown, now() from scored
  on conflict (race_id, user_id) do update
    set points = excluded.points,
        exact_hits = excluded.exact_hits,
        breakdown = excluded.breakdown,
        computed_at = now();

  get diagnostics v_rows = row_count;
  return v_rows;
end $$;
```

### 9.3 Propiedades y justificación

- **Recalculable, no incremental.** Si MotoGP revisa un resultado horas después (sanción, apelación), basta volver a llamar a la función: el resultado es el mismo que si nunca hubiera existido el resultado previo. Un contador incremental haría imposible corregir sin auditoría manual.
- **`race_scores` materializada, `season_standings` derivada.** Los puntos por carrera son caros de recalcular (join sobre todas las apuestas) y raramente cambian → se guardan. El total es una simple suma → se calcula al vuelo. Así nunca hay dos números que puedan contradecirse.
- **Solo cuentan los clasificados.** Si el 3º es descalificado y sube el 4º, la API ya devuelve las posiciones corregidas al reimportar; el recálculo hace el resto.
- **Sprint y carrera puntúan igual y por separado** (decisión 2), y ambas suman a la misma clasificación. Un GP puede dar de 0 a 6 puntos.
- **`breakdown` en JSONB** alimenta el detalle visual "🥇✅ 🥈❌ 🥉✅" del histórico sin recalcular nada en el frontend.
- **Carreras canceladas:** no generan `race_results`, luego no generan `race_scores`, y no cuentan como `races_played`. Sin casos especiales.

---

## 10. Flujo de permisos (RLS)

RLS **activada en todas las tablas de `public`**, sin excepción, y sin política por defecto (deny-all).

### 10.1 Matriz de acceso

| Tabla | Anónimo | Usuario autenticado | Admin | `service_role` |
|---|---|---|---|---|
| `seasons`, `categories`, `circuits`, `events`, `sessions`, `races` | — | SELECT | SELECT | ALL |
| `teams`, `riders`, `rider_season_entries` | — | SELECT | SELECT | ALL |
| `profiles` | — | SELECT todos · UPDATE propio | + UPDATE cualquiera | ALL |
| `user_roles` | — | SELECT propio | SELECT/UPDATE todos | ALL |
| `bets`, `bet_picks` | — | ALL propio · SELECT ajeno **sólo tras el cierre** | + SELECT todos | ALL |
| `race_results`, `race_result_entries` | — | SELECT | SELECT | ALL |
| `race_scores` | — | SELECT | SELECT | ALL |
| `scoring_rules` | — | SELECT | ALL | ALL |
| `sync_runs` | — | — | SELECT | ALL |
| `season_participants` | — | SELECT | ALL | ALL |

### 10.2 Políticas críticas

```sql
-- Catálogo deportivo: lectura para autenticados, escritura sólo service_role
alter table races enable row level security;
create policy races_read on races for select to authenticated using (true);
-- (sin política de escritura → nadie salvo service_role, que bypassa RLS)

-- Apuestas propias
alter table bets enable row level security;

create policy bets_select_own on bets for select to authenticated
  using (user_id = auth.uid());

-- Apuestas ajenas: SÓLO después del cierre  ← evita copiar la apuesta del rival
create policy bets_select_others_after_close on bets for select to authenticated
  using (exists (select 1 from races r
                 where r.id = bets.race_id and now() >= r.closes_at));

create policy bets_insert_own on bets for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from races r
                          where r.id = race_id
                            and not r.is_cancelled
                            and now() < r.closes_at));

create policy bets_update_own on bets for update to authenticated
  using      (user_id = auth.uid()
              and exists (select 1 from races r where r.id = race_id and now() < r.closes_at))
  with check (user_id = auth.uid());

-- Sin política DELETE: una apuesta no se borra nunca (integridad del histórico)

-- Picks: heredan el permiso de su apuesta
alter table bet_picks enable row level security;
create policy bet_picks_rw on bet_picks for all to authenticated
  using      (exists (select 1 from bets b where b.id = bet_id and b.user_id = auth.uid()))
  with check (exists (select 1 from bets b
                      join races r on r.id = b.race_id
                      where b.id = bet_id and b.user_id = auth.uid() and now() < r.closes_at));

create policy bet_picks_select_after_close on bet_picks for select to authenticated
  using (exists (select 1 from bets b join races r on r.id = b.race_id
                 where b.id = bet_id and now() >= r.closes_at));

-- Perfil
create policy profiles_select_all on profiles for select to authenticated using (true);
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on profiles for all to authenticated
  using (internal.is_admin()) with check (internal.is_admin());
```

### 10.3 Justificación

- **La regla del cierre vive en la base de datos, no en la UI.** Es la protección real contra el ataque obvio de la porra: consultar la API con el token propio para ver qué ha apostado el rival antes de decidir. Ocultarlo sólo en el frontend no protege nada.
- **Sin política = sin acceso.** Al no declarar políticas de escritura en las tablas deportivas, únicamente `service_role` (el sincronizador) puede modificarlas. La restricción "el frontend nunca crea carreras" queda garantizada por el motor, no por disciplina.
- **Sin `DELETE` en `bets`.** El histórico es inmutable; "borrar" no es una operación del dominio.
- **`is_admin()` desde el JWT** (§7.3) evita recursión y coste por fila.
- **Nada para `anon`.** La app requiere sesión; no hay vista pública en el alcance inicial. Si más adelante se quiere una clasificación pública, se añade una política concreta sobre `season_standings` sin abrir el resto.

---

## 11. Estructura del proyecto

**Monorepo** (decisión 7), con la librería ya existente dentro:

```
MotoGPorra/
├── apps/
│   ├── web/                    # Next.js + PWA
│   └── sync/                   # Scripts de sincronización (Python)
├── packages/
│   └── motogp_client/          # ← librería existente, movida aquí
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── .github/
│   └── workflows/
│       ├── sync-calendar.yml   # cron semanal + workflow_dispatch
│       ├── sync-riders.yml     # cron semanal + workflow_dispatch
│       ├── sync-results.yml    # cron fin de semana + workflow_dispatch
│       ├── sync-backfill.yml   # solo workflow_dispatch
│       └── deploy-web.yml
└── docs/
```

> **Dos matices sobre tu propuesta.** Primero, `motogp_client` va en `packages/` y no dentro de `apps/sync/`: es una librería reutilizable con su propio `pyproject.toml`, sus tests y su ciclo de vida, mientras que `apps/sync` es el consumidor. `apps/sync/pyproject.toml` la declara como dependencia local (`motogp-client @ file://../../packages/motogp_client`), así que un `pip install -e` en CI resuelve todo sin publicar en PyPI.
>
> Segundo, **Vercel necesita saber que la raíz del proyecto es `apps/web`.** Se configura como *Root Directory* en el proyecto de Vercel; `deploy-web.yml` solo hace falta si quieres controlar el despliegue desde Actions en vez de con la integración nativa de Vercel — que es más simple y da previews por rama. Recomiendo empezar sin `deploy-web.yml`.

### 11.1 `apps/web`

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # Root layout, fuentes, PWA meta
│   │   ├── globals.css
│   │   ├── (auth)/                        # Sin sesión
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   ├── (app)/                         # Requiere sesión — bottom nav
│   │   │   ├── layout.tsx                 # Shell móvil + navegación inferior
│   │   │   ├── page.tsx                   # Home: próxima carrera + posición
│   │   │   ├── races/
│   │   │   │   ├── page.tsx               # Calendario de la temporada
│   │   │   │   └── [raceId]/
│   │   │   │       ├── page.tsx           # Detalle: resultado, apuestas de todos
│   │   │   │       └── bet/page.tsx       # Formulario de apuesta
│   │   │   ├── standings/page.tsx         # Clasificación general
│   │   │   ├── history/page.tsx           # Mi histórico
│   │   │   └── profile/page.tsx           # Perfil y ajustes
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── layout.tsx             # Guard de rol
│   │   │       ├── page.tsx               # Panel
│   │   │       ├── users/page.tsx
│   │   │       ├── races/page.tsx         # Abrir/cerrar excepcionalmente
│   │   │       └── sync/page.tsx          # Historial y disparo manual
│   │   ├── auth/callback/route.ts         # Intercambio de código OAuth/magic link
│   │   ├── api/admin/sync/route.ts        # Disparo del sincronizador
│   │   ├── manifest.ts                    # Manifest PWA
│   │   ├── opengraph-image.tsx
│   │   ├── error.tsx · not-found.tsx · loading.tsx
│   │
│   ├── components/
│   │   ├── ui/                            # Primitivas sin lógica de negocio
│   │   │   ├── button.tsx · card.tsx · sheet.tsx · input.tsx
│   │   │   ├── avatar.tsx · badge.tsx · skeleton.tsx · toast.tsx
│   │   ├── layout/
│   │   │   ├── bottom-nav.tsx · app-header.tsx · install-prompt.tsx
│   │   ├── races/
│   │   │   ├── race-card.tsx · race-countdown.tsx · race-status-badge.tsx
│   │   ├── bets/
│   │   │   ├── bet-form.tsx               # Client Component
│   │   │   ├── rider-picker.tsx           # Bottom sheet de selección
│   │   │   ├── podium-slot.tsx · bet-summary.tsx
│   │   ├── standings/
│   │   │   ├── standings-table.tsx · standings-row.tsx · podium-highlight.tsx
│   │   └── profile/
│   │       └── avatar-uploader.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts                  # createServerClient (RSC/actions)
│   │   │   ├── client.ts                  # createBrowserClient
│   │   │   ├── admin.ts                   # service_role — import 'server-only'
│   │   │   └── proxy.ts                   # refresco de sesión (helper)
│   │   ├── auth/
│   │   │   ├── session.ts                 # getSession, requireUser, requireAdmin
│   │   │   └── actions.ts                 # Server Actions de auth
│   │   ├── validation/                    # Esquemas Zod compartidos
│   │   │   ├── bet.schema.ts · profile.schema.ts · auth.schema.ts
│   │   └── config/
│   │       ├── env.ts                     # Validación de variables de entorno con Zod
│   │       └── constants.ts
│   │
│   ├── services/                          # Lógica de negocio · sin JSX · testeable
│   │   ├── races.service.ts               # getUpcomingRace, getSeasonCalendar…
│   │   ├── bets.service.ts                # getMyBet, placeBet (RPC), getRaceBets
│   │   ├── standings.service.ts
│   │   ├── riders.service.ts
│   │   ├── profile.service.ts
│   │   ├── admin.service.ts
│   │   └── sync.service.ts                # Disparo y lectura de sync_runs
│   │
│   ├── hooks/                             # Sólo cliente
│   │   ├── use-countdown.ts
│   │   ├── use-realtime-standings.ts
│   │   ├── use-install-prompt.ts
│   │   └── use-media-query.ts
│   │
│   ├── types/
│   │   ├── database.types.ts              # GENERADO por Supabase CLI — no editar
│   │   ├── domain.ts                      # Tipos de dominio de la app
│   │   └── api.ts                         # DTOs de Server Actions
│   │
│   └── utils/                             # Puras, sin dependencias
│       ├── date.ts                        # Formato y zonas horarias
│       ├── format.ts · cn.ts · result.ts  # Result<T,E> para errores tipados
│
├── public/
│   ├── icons/                             # 192, 512, maskable, apple-touch
│   ├── screenshots/                       # Para el prompt de instalación
│   └── fonts/
├── supabase/                              # (enlace al paquete compartido)
├── proxy.ts                               # ⚠️ Next 16: antes middleware.ts
├── next.config.ts                         # + Serwist
├── tailwind.config.ts · postcss.config.mjs
├── eslint.config.mjs · .prettierrc
├── tsconfig.json                          # strict + noUncheckedIndexedAccess
└── package.json
```

### 11.2 `supabase/`

```
supabase/
├── migrations/
│   ├── 20260201000000_extensions.sql
│   ├── 20260201000100_enums.sql
│   ├── 20260201000200_catalog.sql          # seasons, categories, circuits, events…
│   ├── 20260201000300_riders.sql
│   ├── 20260201000400_users.sql            # profiles, roles, trigger
│   ├── 20260201000500_bets.sql
│   ├── 20260201000600_results.sql
│   ├── 20260201000700_scoring.sql          # scoring_rules, race_scores, standings
│   ├── 20260201000800_functions.sql        # place_bet, recalculate_race_scores
│   ├── 20260201000900_rls.sql
│   └── 20260201001000_sync.sql
├── seed.sql                                # categorías, temporada activa, admin inicial
└── config.toml
```

### 11.3 `apps/sync` (diseño, no implementación)

```
apps/sync/
├── src/motogporra_sync/
│   ├── __main__.py            # CLI: python -m motogporra_sync results
│   ├── config.py              # Settings desde entorno
│   ├── db.py                  # Pool psycopg, transacciones
│   ├── jobs/
│   │   ├── calendar.py · riders.py · results.py · backfill.py · recalculate.py
│   ├── mappers/               # MotoGP → esquema propio (único punto de traducción)
│   │   ├── event_mapper.py · session_mapper.py · circuit_mapper.py
│   │   ├── rider_mapper.py · result_mapper.py
│   └── repositories/          # Upserts por motogp_*_id
│       ├── events_repo.py · riders_repo.py · results_repo.py
├── tests/                     # Con respuestas de MotoGP grabadas
├── Dockerfile                 # Reutilizable en Cloud Run si se migra
└── pyproject.toml             # depende de packages/motogp_client
```

**Los mappers son la única capa que conoce las rarezas de la API**, todas verificadas en vivo:

| Rareza | Mapper responsable |
|---|---|
| `riders_api_uuid` ≠ `rider.id` en clasificaciones | `result_mapper` |
| `sequence` es el número de ronda real | `event_mapper` |
| `time_zone` llega en MAYÚSCULAS (`ASIA/BANGKOK`) → normalizar a IANA | `event_mapper` |
| Sesión = `type` + `number` (FP+1 → FP1) | `session_mapper` |
| `date_start` tiene offset local; `session.date` ya es UTC | `event_mapper` / `session_mapper` |
| `INSTND`/`OUTSTND` → `is_classified` | `result_mapper` |
| `circuit` trae país, ciudad y coordenadas que el `Circuit` de la librería no modela | `circuit_mapper` |

### 11.4 Reglas de arquitectura del código

1. **Los componentes no consultan la base de datos.** Sólo `services/*` construyen queries. Un componente que necesite datos los recibe por props o llama a un servicio desde un Server Component.
2. **`services/` no importa React ni JSX.** Es código puro y testeable.
3. **`utils/` no importa nada del proyecto.** Funciones puras.
4. **`lib/supabase/admin.ts` empieza con `import 'server-only'`.** Un import accidental desde cliente rompe el build, no la producción.
5. **Client Components sólo donde hacen falta:** formulario de apuesta, cuenta atrás, selector de pilotos, uploader de avatar, prompt de instalación PWA. Todo lo demás es RSC.
6. **Tipos generados, nunca escritos a mano.** `supabase gen types typescript` en un script de npm; `database.types.ts` es la fuente de verdad del tipado.

### 11.5 Diseño visual y PWA

- **Mobile First real:** navegación inferior con 4–5 destinos, todos los objetivos táctiles ≥44 px, acciones primarias en el tercio inferior (alcance del pulgar), bottom sheets en lugar de modales centrados, `safe-area-inset` respetada.
- **Estética MotoGP:** fondo oscuro grafito, rojo MotoGP como acento único, tipografía condensada para dorsales y cronos, tarjetas con banderas de país, medallas 🥇🥈🥉 como anclas visuales. Minimalismo: una acción primaria por pantalla.
- **PWA sin librería** (decisión 10): `manifest.ts` tipado, iconos 192/512 + maskable + `apple-touch-icon` generados por `npm run icons`, `display: standalone`, y un `public/sw.js` escrito a mano. En iOS, prompt propio con instrucciones "Compartir → Añadir a pantalla de inicio", ya que Safari no expone `beforeinstallprompt`.
- **Qué cachea el worker y qué no** (decisión 11):

  | Petición | Estrategia | Por qué |
  |---|---|---|
  | `/_next/static/*`, `/icons/*` | `CacheFirst` | Llevan hash en el nombre o son públicos: no pueden quedar obsoletos |
  | Navegaciones | Red, **sin guardar**; si falla, `/offline` | El HTML lo produce un RSC tras `requireUser()`: es distinto para cada usuario |
  | Cargas RSC, rutas de API, Server Actions | Sin interceptar | Mismo motivo, y además hay `POST` de por medio |
  | Supabase y cualquier otro origen | Sin interceptar | La sesión y la RLS son cosa del servidor, no del caché |

  El diseño original decía "precache del shell". No se puede: al construir, **todas** las rutas de la app salen `ƒ` (dinámicas) porque el layout de `(app)` llama a `requireUser()`. Lo único estático que hay es `/offline`, y es exactamente lo que se precarga.

---

## 12. Roadmap por fases

| Fase | Contenido | Entregable verificable |
|---|---|---|
| **0 — Fundación** ✅ | Monorepo, Next.js 16 + TS estricto + Tailwind 4, ESLint/Prettier con reglas de arquitectura, validación de entorno con Zod, CI | `format` + `lint` + `typecheck` + `build` en verde. Pendiente: `git init` y proyecto Supabase |
| **1 — Base de datos** ✅ | 14 migraciones (§4), enums, índices, constraints, funciones, RLS, datos de referencia | Aplicadas y verificadas: `npm run db:verify` pasa 25/25, incluido que un usuario no ve la apuesta ajena antes del cierre. Pendiente: tipos TS generados (fase 2) |
| **2 — Autenticación** | Registro, login, verificación, recuperación, trigger `handle_new_user`, hook de claim de rol, middleware, layouts protegidos | Ciclo completo de alta y recuperación desde el móvil |
| **3 — Shell y datos de sólo lectura** | Layout móvil, bottom nav, calendario, detalle de carrera, ficha de piloto. Datos cargados a mano en la base para desarrollar sin sincronizador | Navegación completa con datos reales de una temporada |
| **4 — Apuestas** | `place_bet`, formulario, selector de pilotos, cuenta atrás, edición mientras esté abierta, estado vacío/cerrado | Un usuario apuesta y edita desde el móvil; el cierre se respeta con reloj manipulado |
| **5 — Resultados y puntuación** | `recalculate_race_scores`, pantalla de resultado, comparación apuesta/resultado, histórico personal | Cargando un resultado manualmente en la base, la clasificación cuadra |
| **6 — Clasificación** | Vista de standings, desempates, evolución, realtime | Clasificación correcta y actualizada sin recargar |
| **7a — Ampliar `motogp-client`** ✅ | Campos de `Event`, `Session`, `Circuit`, `Rider`, `Team` y método `get_event_sessions()` (§13) | 66 tests en verde; verificado contra la API real |
| **7b — Sincronizador** ✅ | `apps/sync` con mappers y jobs `calendar`, `riders`, `results` y `backfill`; auditoría en `sync_runs`; workflows de Actions | **Temporada 2026 completa**: 22 circuitos, 22 GP, 177 sesiones, 44 carreras, 29 pilotos, 22 resultados oficiales y 476 líneas de clasificación **sin un solo piloto sin resolver**. Verificado línea a línea contra la API: 0 discrepancias. Idempotencia confirmada. Pendiente: disparo manual desde el panel de admin (fase 8) |
| **8 — Administración** | Panel, gestión de usuarios y roles, apertura/cierre excepcional, revisión de resultados, historial de sync | El administrador opera sin tocar la base de datos |
| **9 — PWA y pulido** | Serwist, manifest, iconos, offline del shell, prompt de instalación iOS/Android, animaciones, accesibilidad, Lighthouse | Instalable en Android e iPhone; Lighthouse PWA en verde |
| **10 — Producción** | Dominio, backups, monitorización, Sentry, tests E2E del flujo crítico, documentación | Temporada real en marcha |

**Criterio de ordenación:** cada fase deja el sistema en un estado desplegable y demostrable. La base de datos va primero porque es la decisión más cara de revertir. El sincronizador va en la fase 7, no antes, porque hasta entonces se puede trabajar con datos cargados a mano — y así el diseño de las tablas ya está validado por uso real antes de escribir los mappers.

---

## 13. Ampliación necesaria de `motogp-client`

El sincronizador necesita datos que **la API ya devuelve** pero que la librería no expone: los modelos declaran una fracción de los campos y, gracias a `extra="allow"`, el resto queda en `.raw` sin contrato ni tipado. Además, `SessionsEndpoint` es deliberadamente privado, así que **no hay forma pública de obtener las fechas de sesión** — y sin ellas no se puede calcular el cierre automático, que es un requisito explícito.

Todo lo siguiente es **retrocompatible**: solo añade campos y un método.

### 13.1 Campos a modelar (ya presentes en la respuesta real)

| Modelo | Añadir | Verificado |
|---|---|---|
| `Event` | `date_start`, `date_end` (`datetime` con offset), `sequence: int` (**el número de ronda real**), `time_zone`, `has_results` | ✅ 22 eventos |
| `Session` | `date: datetime` (**UTC**), `number: int \| None`, `status`, y una propiedad `code` = `type + number` (`FP1`, `Q2`) | ✅ 8 sesiones |
| `Circuit` | `iso_code`, `country`, `city`, `lat`, `lng`, y `track.lenght` / `assets` si interesa el SVG del trazado | ✅ |
| `Rider` | `birth_date`, `birth_city`, `start_year`, `retired`, `retired_year`, `published` | ✅ |
| `Team` | `legacy_id`, `color`, `text_color`, `picture` | ✅ |
| `RaceResult` | `event_uuid` y `session_id`, para poder auditar el origen del resultado | ✅ |

### 13.2 Método público nuevo

```python
def get_event_sessions(self, event_id: str, category: str) -> list[Session]:
    """Sesiones de un GP para una categoría, con sus fechas en UTC."""
```

Encapsula la cadena `get_detail → resolve_category_uuid → sessions.list` que hoy solo existe dentro de `_build_race_result`. Sin esto, `apps/sync` tendría que llamar a `client._events` y `client._sessions` —atributos privados— rompiendo justo el encapsulamiento que justifica la existencia de la librería.

### 13.3 Corrección menor detectada

`_iter_finished_race_results` numera las rondas con `enumerate(races, start=1)`, es decir, por posición en la lista. Pero `sequence` **sí existe** en la respuesta real (verificado: 1, 2, 3, 4…), y `get_by_round` ya lo prefiere vía `_EXPLICIT_ROUND_KEYS`. Convendría unificar ambos caminos en `sequence`: si un GP se cancela a mitad de temporada, la posición en la lista y el número oficial de ronda dejan de coincidir, y `RaceResult.round` empezaría a mentir.

### 13.4 Alternativa descartada

Que `apps/sync` lea directamente de `.raw` y de los endpoints privados. Funciona hoy, pero mueve el conocimiento de la API de MotoGP fuera de la librería, que es exactamente la restricción que define esta arquitectura: *toda* la comunicación con MotoGP vive en `motogp-client`. Un cambio en la API pasaría de tocar un mapper a tocar dos proyectos.

---

## 14. Versiones y hallazgos de la implementación

Lo que se descubrió construyendo, y que no estaba en el diseño sobre el papel.

| Pieza | Versión | Nota |
|---|---|---|
| Next.js | 16.2.12 | Turbopack por defecto en `dev` y `build` |
| React | 19.2.4 | — |
| TypeScript | 5.x | `strict` + 6 flags adicionales (§11.4) |
| Tailwind CSS | 4.x | Configuración CSS-first, sin `tailwind.config.ts` |
| ESLint | 9.x | Flat config |
| Zod | 4.4.3 | `z.url()`, `z.prettifyError()` — API v4 |
| Node | 24.18.1 LTS | Misma versión en local y en CI |
| Git | 2.55.0 | — |

> Los cambios de ruptura de Next.js 16, las reglas de arquitectura que verifica el linter y las trampas de la API de MotoGP están recogidos en [CLAUDE.md](../CLAUDE.md). Aquí solo queda el **relato de cómo se descubrieron**.

### Hallazgo de la Fase 1: `FOR SHARE` y RLS

`place_bet` leía la carrera con `SELECT ... FOR SHARE` como red de seguridad frente a modificaciones concurrentes. Fallaba **siempre** con `RACE_NOT_FOUND`.

**Causa:** bajo RLS, PostgreSQL evalúa también las políticas de **UPDATE** en cualquier consulta con cláusula de bloqueo — bloquear una fila se considera intención de modificarla. Como `races` solo tiene política de UPDATE para administradores, un jugador normal no obtenía ninguna fila aunque la carrera existiera y estuviera abierta.

**Corregido** en `20260802001300`: se elimina el bloqueo. No hacía falta, porque la ventana temporal ya se valida dos veces de forma independiente dentro de la misma transacción — en `internal.is_betting_open()` y en la política RLS de INSERT sobre `bets`.

> Lección general: **cualquier cláusula de bloqueo dentro de una función `SECURITY INVOKER` exige que el rol tenga política de UPDATE sobre esa tabla.** Conviene recordarlo antes de añadir `FOR UPDATE` en cualquier función futura.

### Hallazgo de la Fase 7b: la conexión imposible

El diseño preveía `psycopg` contra el pooler de Supabase, por la atomicidad. Al implementarlo resultó inviable: el host directo solo publica registro **AAAA** y la red de desarrollo no tiene ruta IPv6 (Node ni siquiera resuelve el nombre), y los poolers de `eu-central-1` responden `tenant/user not found`.

Se cambió a PostgREST sobre HTTPS, asumiendo la pérdida de atomicidad por job y compensándola con idempotencia. Migrar de vuelta, si algún día se ejecuta desde un entorno con IPv6, es cambiar únicamente `apps/sync/db.py`.

### Hallazgo de la Fase 9: Serwist no se lleva con Turbopack, y aquí no hacía falta

El diseño (§11.5) daba por hecho Serwist. Al ir a instalarlo, dos problemas.

**El técnico.** `@serwist/next@9.5.12` en modo plugin se engancha mediante `config.webpack()`, y Turbopack no llama a ese hook jamás: el worker sencillamente no se generaría. La propia guía de Next lo avisa de pasada («this plugin currently requires webpack configuration») y el paquete lo dice por consola. Las salidas eran `next build --webpack` —renunciar a Turbopack—, `@serwist/turbopack` —experimental— o el *configurator mode*, que sí funciona pero añade cinco dependencias y un `serwist build` posterior que rastrea el interior de `.next/`.

**El de fondo, que es el que decidió.** La estrategia escrita era "precache del shell", y aquí no hay shell que precachear: `(app)/layout.tsx` llama a `requireUser()`, así que el build marca `ƒ` todas las rutas de la app. Serwist habría buscado HTML prerenderizado en `.next/server/app/**` sin encontrar nada útil — y de haberlo encontrado, guardar el HTML de una página autenticada es arriesgarse a servirle a un usuario la pantalla ya renderizada de otro.

Lo que de verdad hacía instalable la app era el manifest y los iconos, no el caché. Así que el worker se escribió a mano en 100 líneas: `CacheFirst` solo sobre lo público e inmutable, navegación siempre contra la red con `/offline` de red de seguridad, y todo lo demás sin interceptar. Cero dependencias, cero pasos de build, Turbopack intacto.

> Lección general: **antes de adoptar una librería de build, comprobar contra qué bundler engancha.** El ecosistema de Next todavía asume webpack en muchos sitios, y este proyecto ya no lo usa.

### Hallazgo de la Fase 9: `setState` dentro de un `useEffect` ahora es error de lint

El hook de instalación detectaba iOS en un `useEffect` y llamaba a `setEstado`. ESLint lo rechazó con `react-hooks/set-state-in-effect` — la misma regla que CLAUDE.md ya enunciaba a mano ("no resetear estado desde un `useEffect`"), pero ahora verificada por el linter.

La salida no es un `useState` con valor inicial calculado, porque leer `window` durante el render rompe la hidratación. Es **`useSyncExternalStore`**, que existe justo para esto: da un valor en servidor (`'oculto'`, sin invitación) y otro en cliente, sin render en cascada. Merece recordarse para cualquier otro dato que solo exista en el navegador — `matchMedia`, `localStorage`, `navigator`.

### Hallazgo de la Fase 7b: 4 peticiones donde bastaba 1

El diseño preveía `get_completed_race_results()`, que resuelve evento → categoría → sesión → clasificación: 4 peticiones por resultado, ~176 por temporada. Pero el job `calendar` ya guarda los 177 `motogp_session_id`, así que se añadió `get_session_classification(session_id)` y el coste bajó a **1 petición por resultado**: ~44 por temporada completa y 1-2 en el cron del fin de semana.

---

## 15. Cómo mantener estos documentos

- **Una decisión nueva** → fila en «Decisiones cerradas», con su consecuencia.
- **Un hallazgo al implementar** → apartado en §14, contando qué se creía y qué resultó ser.
- **Cambio de estado de una fase** → tabla de «Estado actual», y actualizar la fecha.
- **Una regla que ya no va a cambiar** (convención, comando, trampa conocida) → **muévela a [CLAUDE.md](../CLAUDE.md)** y bórrala de aquí. Que un dato viva en dos sitios es garantía de que acabarán contradiciéndose.

`scoring_rules` conserva la columna `points_podium_any` (hoy a 0) y admitiría un multiplicador por `kind` si algún día se quisiera que el sprint valga menos — pero **la regla vigente es 1 punto por posición acertada, igual en sprint y en carrera**. Verificado en la prueba de Mugello: cambiar la regla y recalcular altera los puntos, y revertirla los restaura.
