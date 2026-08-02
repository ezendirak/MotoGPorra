-- =========================================================================
-- Resultados oficiales importados. Ver docs/DESIGN.md §4.9.
--
-- Se guarda el resultado COMPLETO, no solo el podio: cuesta lo mismo y
-- habilita futuras modalidades (top-5, primer abandono...) sin reimportar.
-- `raw_payload` permite reprocesar sin volver a llamar a MotoGP.
-- =========================================================================

create table public.race_results (
  id          uuid primary key default gen_random_uuid(),
  race_id     uuid not null unique references public.races(id) on delete cascade,
  status      public.result_status not null default 'provisional',
  imported_at timestamptz not null default now(),
  source      text not null default 'motogp-client',
  raw_payload jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger race_results_set_updated_at before update on public.race_results
  for each row execute function internal.set_updated_at();

-- -------------------------------------------------------------------------
-- Líneas de la clasificación.
--
-- La API solo distingue 'INSTND' (clasificado) y 'OUTSTND' (no clasificado):
-- no diferencia DNF, DNS ni DSQ. De ahí `is_classified` + `status_raw` en
-- lugar de un enum de cinco valores imposibles de rellenar.
--
-- Los tiempos se guardan como TEXTO tal y como llegan ('40:53.148', '1.996').
-- Nunca ordenamos por tiempo —ordenamos por `position`— así que convertirlos
-- a milisegundos solo añadiría errores de parseo sin ningún beneficio.
-- -------------------------------------------------------------------------
create table public.race_result_entries (
  id             uuid primary key default gen_random_uuid(),
  race_result_id uuid not null references public.race_results(id) on delete cascade,
  -- FK `restrict` + NOT NULL: si el sincronizador no logra reconciliar un
  -- piloto, la base de datos aborta la importación en vez de dejar el podio
  -- a medias y la clasificación mintiendo. Ver §6.2.1.
  rider_id       uuid not null references public.riders(id) on delete restrict,
  position       smallint check (position >= 1),   -- null si no clasificó
  is_classified  boolean not null default true,
  status_raw     text,                             -- 'INSTND' | 'OUTSTND'
  total_time     text,                             -- '40:53.148'
  gap_to_first   text,                             -- '0.000' | '1.996'
  gap_laps       text,                             -- vueltas de retraso si se retiró
  championship_points numeric(5, 2),               -- la API devuelve float (25.0)
  -- Texto plano en la clasificación ('Ducati Lenovo Team'), distinto del
  -- nombre en /riders ('Honda LCR') y del patrocinado. No se intenta casar
  -- con `teams`: es un dato histórico del resultado.
  team_name      text,
  constructor_id uuid references public.constructors(id) on delete set null,
  number         smallint,
  constraint rre_result_rider_uk unique (race_result_id, rider_id)
);

-- Dos pilotos no pueden compartir posición en el mismo resultado.
create unique index rre_position_uk on public.race_result_entries (race_result_id, position)
  where position is not null;

create index rre_rider_idx on public.race_result_entries (rider_id);
