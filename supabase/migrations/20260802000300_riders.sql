-- =========================================================================
-- Constructores, equipos, pilotos e inscripciones por temporada.
-- Ver docs/DESIGN.md §4.5.
--
-- La separación entre `riders` (identidad estable de por vida) y
-- `rider_season_entries` (inscripción anual con equipo y dorsal) es lo que
-- permite conservar el histórico: un piloto cambia de equipo y de dorsal
-- entre temporadas, y `get_riders` solo devuelve la temporada en curso.
-- El histórico se construye por ACUMULACIÓN y no es reconstruible hacia atrás.
-- =========================================================================

create table public.constructors (
  id                    uuid primary key default gen_random_uuid(),
  motogp_constructor_id text unique,
  motogp_legacy_id      integer unique,
  name                  text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger constructors_set_updated_at before update on public.constructors
  for each row execute function internal.set_updated_at();

create table public.teams (
  id               uuid primary key default gen_random_uuid(),
  motogp_team_id   text unique,
  motogp_legacy_id integer unique,
  constructor_id   uuid references public.constructors(id) on delete set null,
  name             text not null,
  color            text,       -- '#fafafa' — la UI lo usa para la tarjeta del piloto
  text_color       text,
  picture_url      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger teams_set_updated_at before update on public.teams
  for each row execute function internal.set_updated_at();

-- -------------------------------------------------------------------------
-- Pilotos: identidad estable.
--
-- `motogp_legacy_id` NO es decorativo: es la clave de reconciliación de
-- respaldo cuando se importan resultados. Ver §6.2.1 — los UUID de piloto
-- del endpoint de resultados pertenecen a un espacio distinto del de
-- /riders, y sin esta columna un fallo de reconciliación dejaría todas las
-- puntuaciones a cero en silencio.
-- -------------------------------------------------------------------------
create table public.riders (
  id               uuid primary key default gen_random_uuid(),
  motogp_rider_id  text not null unique,
  motogp_legacy_id integer unique,
  first_name       text,
  last_name        text,
  -- No es columna generada: `first_name` y `surname` son opcionales en la
  -- API y `a || NULL` da NULL. Lo compone el mapper de forma tolerante.
  full_name        text not null check (length(trim(full_name)) > 0),
  nickname         text,
  country_code     char(2),
  country_name     text,
  birth_date       date,
  birth_city       text,
  start_year       smallint,
  is_retired       boolean not null default false,
  -- La API de /riders NO devuelve foto. Queda nullable; la UI cae en un
  -- avatar con el dorsal, que además se reconoce mejor en miniatura.
  photo_url        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index riders_last_name_idx on public.riders (last_name);
create index riders_legacy_idx on public.riders (motogp_legacy_id);

create trigger riders_set_updated_at before update on public.riders
  for each row execute function internal.set_updated_at();

-- -------------------------------------------------------------------------
-- Inscripción por temporada + categoría → el histórico entre temporadas.
-- -------------------------------------------------------------------------
create table public.rider_season_entries (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references public.seasons(id) on delete cascade,
  category_id    uuid not null references public.categories(id) on delete restrict,
  rider_id       uuid not null references public.riders(id) on delete cascade,
  team_id        uuid references public.teams(id) on delete set null,
  sponsored_team text,     -- 'CASTROL Honda LCR': el nombre comercial del año
  number         smallint check (number between 0 and 999),
  -- `GET /riders` devolvió 29 pilotos para MotoGP 2026, no 22: incluye
  -- retirados y sustitutos. El sync marca is_active y el índice parcial
  -- hace que los inactivos ni aparezcan en el selector de apuesta.
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint rse_uk unique (season_id, category_id, rider_id)
);

create index rse_lookup_idx on public.rider_season_entries (season_id, category_id)
  where is_active;

create trigger rse_set_updated_at before update on public.rider_season_entries
  for each row execute function internal.set_updated_at();
