-- =========================================================================
-- Catálogo deportivo: temporadas, categorías, circuitos, eventos, sesiones
-- y carreras. Ver docs/DESIGN.md §4.3 y §4.4.
--
-- Todos los campos `motogp_*` son las claves de reconciliación del
-- sincronizador. Nunca se casa por nombre: los Grandes Premios cambian de
-- nombre por patrocinio, los identificadores no.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Temporadas
-- -------------------------------------------------------------------------
create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  year       smallint not null unique check (year between 1949 and 2100),
  name       text not null,
  starts_on  date,
  ends_on    date,
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Como mucho una temporada activa: el índice parcial lo impone el motor.
create unique index seasons_single_active_idx on public.seasons (is_active)
  where is_active;

create trigger seasons_set_updated_at before update on public.seasons
  for each row execute function internal.set_updated_at();

-- -------------------------------------------------------------------------
-- Categorías (MotoGP, Moto2, Moto3, MotoE)
-- -------------------------------------------------------------------------
create table public.categories (
  id                 uuid primary key default gen_random_uuid(),
  motogp_category_id text unique,
  code               text not null unique,
  name               text not null,
  sort_order         smallint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger categories_set_updated_at before update on public.categories
  for each row execute function internal.set_updated_at();

-- -------------------------------------------------------------------------
-- Circuitos
--
-- El objeto `circuit` del calendario es mucho más rico de lo que modela la
-- librería: trae iso_code, country, city, coordenadas y hasta el SVG del
-- trazado. Se aprovecha todo porque cuesta lo mismo y la UI lo agradece.
-- -------------------------------------------------------------------------
create table public.circuits (
  id                  uuid primary key default gen_random_uuid(),
  motogp_circuit_id   text unique,
  motogp_circuit_uuid text unique,   -- 'results-api-circuit-uuid'
  name                text not null,
  country_code        char(2),
  country_name        text,
  city                text,
  latitude            numeric(9, 6),
  longitude           numeric(9, 6),
  length_meters       integer check (length_meters > 0),
  left_corners        smallint,
  right_corners       smallint,
  layout_svg_url      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index circuits_country_idx on public.circuits (country_code);

create trigger circuits_set_updated_at before update on public.circuits
  for each row execute function internal.set_updated_at();

-- -------------------------------------------------------------------------
-- Grandes Premios
-- -------------------------------------------------------------------------
create table public.events (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references public.seasons(id) on delete cascade,
  circuit_id        uuid references public.circuits(id) on delete set null,
  motogp_event_id   text not null,
  motogp_event_uuid text,
  name              text not null,
  short_name        text,
  -- Número de ronda: viene del campo real `sequence` de la API, no de la
  -- posición en la lista. Si un GP se cancela, la posición dejaría de
  -- coincidir con la ronda oficial.
  round             smallint check (round > 0),
  country_code      char(2),
  starts_at         timestamptz,
  ends_at           timestamptz,
  time_zone         text,
  has_results       boolean not null default false,
  is_cancelled      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint events_motogp_uk unique (season_id, motogp_event_id),
  constraint events_dates_ck check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index events_season_round_idx on public.events (season_id, round);
create index events_starts_at_idx on public.events (starts_at);

create trigger events_set_updated_at before update on public.events
  for each row execute function internal.set_updated_at();

-- -------------------------------------------------------------------------
-- Sesiones del GP (las 8: FP1, PR, FP2, Q1, Q2, SPR, WUP, RAC)
--
-- Se guardan TODAS, no solo las apostables, porque el cierre de apuestas se
-- calcula como `min(scheduled_at)` del evento — es decir, FP1. Sin las
-- sesiones habría que introducir fechas a mano.
--
-- `scheduled_at` llega ya en UTC desde la API: no hay conversión de zona
-- horaria que pueda salir mal.
-- -------------------------------------------------------------------------
create table public.sessions (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  category_id       uuid not null references public.categories(id) on delete restrict,
  motogp_session_id text not null unique,
  type_code         text not null,          -- 'FP','PR','Q','SPR','WUP','RAC'
  number            smallint,               -- 1 ó 2 para FP y Q; null en el resto
  code              text not null,          -- 'FP1','Q2','SPR','RAC' (lo compone el sync)
  kind              public.session_kind not null,
  scheduled_at      timestamptz,
  is_bettable       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index sessions_event_cat_idx on public.sessions (event_id, category_id);
create index sessions_scheduled_idx on public.sessions (scheduled_at);

create trigger sessions_set_updated_at before update on public.sessions
  for each row execute function internal.set_updated_at();

-- -------------------------------------------------------------------------
-- Carreras: la unidad sobre la que se apuesta y se puntúa.
--
-- Un GP genera DOS filas (sprint y carrera), ambas con el MISMO
-- `betting_closes_at`. Cerrar el sprint el sábado daría al apostante la
-- información de la clasificación; cerrando ambas antes de FP1 se apuesta a
-- ciegas, que es lo que hace justa la porra.
-- -------------------------------------------------------------------------
create table public.races (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references public.seasons(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  session_id  uuid references public.sessions(id) on delete set null,
  kind        public.session_kind not null check (kind in ('sprint', 'race')),

  scheduled_at               timestamptz,
  betting_closes_at          timestamptz,  -- FP1 − 15 min, lo calcula el sync
  betting_closes_at_override timestamptz,  -- excepción del administrador
  closes_at timestamptz generated always as
    (coalesce(betting_closes_at_override, betting_closes_at)) stored,

  status_override public.race_status,
  is_cancelled    boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint races_event_category_kind_uk unique (event_id, category_id, kind)
);

create index races_season_sched_idx on public.races (season_id, scheduled_at);
create index races_closes_at_idx on public.races (closes_at);

create trigger races_set_updated_at before update on public.races
  for each row execute function internal.set_updated_at();

comment on column public.races.closes_at is
  'Momento efectivo de cierre. Es la fuente de verdad usada por RLS y por place_bet: el reloj del cliente nunca decide.';
