-- =========================================================================
-- Reglas de puntuación y puntos materializados. Ver docs/DESIGN.md §4.10.
--
-- Regla vigente: 1 punto por posición acertada, igual en sprint y en carrera.
-- Un Gran Premio reparte de 0 a 6 puntos.
-- =========================================================================

create table public.scoring_rules (
  id                    uuid primary key default gen_random_uuid(),
  season_id             uuid not null references public.seasons(id) on delete cascade,
  points_exact_position smallint not null default 1 check (points_exact_position >= 0),
  -- Piloto acertado pero en otra posición del podio. Hoy a 0; existe para
  -- poder cambiar la regla sin migrar el esquema a mitad de temporada.
  points_podium_any     smallint not null default 0 check (points_podium_any >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint scoring_rules_season_uk unique (season_id)
);

create trigger scoring_rules_set_updated_at before update on public.scoring_rules
  for each row execute function internal.set_updated_at();

-- -------------------------------------------------------------------------
-- Puntos por usuario y carrera.
--
-- Materializados porque recalcularlos exige un join sobre todas las apuestas
-- y cambian rara vez. El total de la temporada, en cambio, es una suma
-- trivial y se deriva en una vista: así nunca hay dos números que puedan
-- contradecirse.
-- -------------------------------------------------------------------------
create table public.race_scores (
  race_id     uuid not null references public.races(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  points      smallint not null default 0 check (points >= 0),
  exact_hits  smallint not null default 0 check (exact_hits between 0 and 3),
  -- {"1": true, "2": false, "3": true} → alimenta el 🥇✅ 🥈❌ 🥉✅ del
  -- histórico sin que el frontend tenga que recalcular nada.
  breakdown   jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (race_id, user_id)
);

create index race_scores_user_idx on public.race_scores (user_id);
