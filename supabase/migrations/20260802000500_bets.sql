-- =========================================================================
-- Apuestas. Ver docs/DESIGN.md §4.8 y §8.
--
-- `bet_picks` es tabla hija y no tres columnas p1/p2/p3. Tres columnas serían
-- más simples hoy, pero si mañana la porra pasa a top-5 o a puntuación
-- ponderada habría que migrar la tabla y toda la lógica. La tabla hija cuesta
-- un join y deja el formato abierto.
--
-- Las invariantes "exactamente 3 picks" y "pilotos inscritos en esa temporada
-- y categoría" las garantiza `place_bet`, el ÚNICO camino de escritura.
-- =========================================================================

create table public.bets (
  id           uuid primary key default gen_random_uuid(),
  race_id      uuid not null references public.races(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Una apuesta por carrera. El sprint y la carrera del domingo son carreras
  -- distintas, así que son dos apuestas distintas.
  constraint bets_user_race_uk unique (user_id, race_id)
);

create index bets_race_idx on public.bets (race_id);
create index bets_user_idx on public.bets (user_id);

create trigger bets_set_updated_at before update on public.bets
  for each row execute function internal.set_updated_at();

create table public.bet_picks (
  bet_id   uuid not null references public.bets(id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  rider_id uuid not null references public.riders(id) on delete restrict,
  primary key (bet_id, position),
  -- Sin pilotos repetidos dentro de la misma apuesta.
  constraint bet_picks_no_duplicate_rider unique (bet_id, rider_id)
);

create index bet_picks_rider_idx on public.bet_picks (rider_id);

comment on constraint bet_picks_no_duplicate_rider on public.bet_picks is
  'No se puede poner al mismo piloto en dos posiciones de la misma apuesta.';
