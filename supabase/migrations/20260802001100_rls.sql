-- =========================================================================
-- Row Level Security. Ver docs/DESIGN.md §10.
--
-- Principios:
--   1. RLS activada en TODAS las tablas de `public`, sin excepción.
--   2. Sin política = sin acceso. Al no declarar políticas de escritura en las
--      tablas deportivas, solo `service_role` (el sincronizador, que bypassa
--      RLS) puede modificarlas. La restricción "el frontend nunca crea
--      carreras" la garantiza el motor, no la disciplina.
--   3. `anon` no tiene NINGUNA política: la app exige sesión.
--   4. La regla del cierre vive aquí, no en la UI. Es la protección real
--      contra el ataque obvio de una porra: consultar la API con el token
--      propio para ver qué ha apostado el rival antes de decidir.
-- =========================================================================

alter table public.seasons              enable row level security;
alter table public.categories           enable row level security;
alter table public.circuits             enable row level security;
alter table public.events               enable row level security;
alter table public.sessions             enable row level security;
alter table public.races                enable row level security;
alter table public.constructors         enable row level security;
alter table public.teams                enable row level security;
alter table public.riders               enable row level security;
alter table public.rider_season_entries enable row level security;
alter table public.profiles             enable row level security;
alter table public.user_roles           enable row level security;
alter table public.season_participants  enable row level security;
alter table public.bets                 enable row level security;
alter table public.bet_picks            enable row level security;
alter table public.race_results         enable row level security;
alter table public.race_result_entries  enable row level security;
alter table public.scoring_rules        enable row level security;
alter table public.race_scores          enable row level security;
alter table public.sync_runs            enable row level security;

-- =========================================================================
-- Catálogo deportivo: lectura para usuarios con sesión, escritura de nadie.
-- =========================================================================
create policy seasons_read    on public.seasons              for select to authenticated using (true);
create policy categories_read on public.categories           for select to authenticated using (true);
create policy circuits_read   on public.circuits             for select to authenticated using (true);
create policy events_read     on public.events               for select to authenticated using (true);
create policy sessions_read   on public.sessions             for select to authenticated using (true);
create policy races_read      on public.races                for select to authenticated using (true);
create policy constructors_read on public.constructors       for select to authenticated using (true);
create policy teams_read      on public.teams                for select to authenticated using (true);
create policy riders_read     on public.riders               for select to authenticated using (true);
create policy rse_read        on public.rider_season_entries for select to authenticated using (true);
create policy race_results_read on public.race_results       for select to authenticated using (true);
create policy rre_read        on public.race_result_entries  for select to authenticated using (true);
create policy race_scores_read on public.race_scores         for select to authenticated using (true);
create policy participants_read on public.season_participants for select to authenticated using (true);

-- El administrador puede abrir o cerrar apuestas excepcionalmente.
create policy races_admin_update on public.races for update to authenticated
  using (internal.is_admin()) with check (internal.is_admin());

create policy participants_admin_all on public.season_participants for all to authenticated
  using (internal.is_admin()) with check (internal.is_admin());

-- =========================================================================
-- Reglas de puntuación: todos las leen, solo el admin las cambia.
-- =========================================================================
create policy scoring_rules_read on public.scoring_rules for select to authenticated using (true);
create policy scoring_rules_admin_all on public.scoring_rules for all to authenticated
  using (internal.is_admin()) with check (internal.is_admin());

-- =========================================================================
-- Perfiles
-- =========================================================================
create policy profiles_select_all on public.profiles for select to authenticated using (true);

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_all on public.profiles for all to authenticated
  using (internal.is_admin()) with check (internal.is_admin());

-- =========================================================================
-- Roles: cada uno ve el suyo; solo el admin ve y cambia los demás.
-- =========================================================================
create policy user_roles_select_own on public.user_roles for select to authenticated
  using (user_id = auth.uid());

create policy user_roles_admin_all on public.user_roles for all to authenticated
  using (internal.is_admin()) with check (internal.is_admin());

-- =========================================================================
-- APUESTAS — la parte que de verdad importa
-- =========================================================================

-- La propia, siempre.
create policy bets_select_own on public.bets for select to authenticated
  using (user_id = auth.uid());

-- Las ajenas, SOLO cuando ya no se puede apostar. Sin esto, cualquiera podría
-- consultar la API con su propio token y copiar la apuesta del rival.
create policy bets_select_others_after_close on public.bets for select to authenticated
  using (not coalesce(internal.is_betting_open(race_id), false));

create policy bets_admin_select on public.bets for select to authenticated
  using (internal.is_admin());

create policy bets_insert_own on public.bets for insert to authenticated
  with check (
    user_id = auth.uid()
    and coalesce(internal.is_betting_open(race_id), false)
  );

create policy bets_update_own on public.bets for update to authenticated
  using (user_id = auth.uid() and coalesce(internal.is_betting_open(race_id), false))
  with check (user_id = auth.uid() and coalesce(internal.is_betting_open(race_id), false));

-- Sin política DELETE: una apuesta no se borra nunca. El histórico es
-- inmutable y "borrar" no es una operación de este dominio.

-- =========================================================================
-- Picks: heredan el permiso de su apuesta.
--
-- Se declaran por operación en lugar de un `FOR ALL`: un FOR ALL con USING
-- solo sobre la propiedad dejaría BORRAR los picks después del cierre, lo que
-- alteraría la puntuación de una carrera ya disputada.
-- =========================================================================
create policy bet_picks_select_own on public.bet_picks for select to authenticated
  using (exists (
    select 1 from public.bets b where b.id = bet_id and b.user_id = auth.uid()
  ));

create policy bet_picks_select_after_close on public.bet_picks for select to authenticated
  using (exists (
    select 1 from public.bets b
    where b.id = bet_id
      and not coalesce(internal.is_betting_open(b.race_id), false)
  ));

create policy bet_picks_admin_select on public.bet_picks for select to authenticated
  using (internal.is_admin());

create policy bet_picks_insert_own on public.bet_picks for insert to authenticated
  with check (exists (
    select 1 from public.bets b
    where b.id = bet_id
      and b.user_id = auth.uid()
      and coalesce(internal.is_betting_open(b.race_id), false)
  ));

create policy bet_picks_update_own on public.bet_picks for update to authenticated
  using (exists (
    select 1 from public.bets b
    where b.id = bet_id
      and b.user_id = auth.uid()
      and coalesce(internal.is_betting_open(b.race_id), false)
  ))
  with check (exists (
    select 1 from public.bets b
    where b.id = bet_id
      and b.user_id = auth.uid()
      and coalesce(internal.is_betting_open(b.race_id), false)
  ));

-- DELETE permitido solo mientras estén abiertas: lo necesita `place_bet`,
-- que reemplaza los picks al modificar una apuesta.
create policy bet_picks_delete_own on public.bet_picks for delete to authenticated
  using (exists (
    select 1 from public.bets b
    where b.id = bet_id
      and b.user_id = auth.uid()
      and coalesce(internal.is_betting_open(b.race_id), false)
  ));

-- =========================================================================
-- Auditoría de sincronización: solo el administrador.
-- =========================================================================
create policy sync_runs_admin_select on public.sync_runs for select to authenticated
  using (internal.is_admin());

-- =========================================================================
-- Vistas: las crea `postgres`, así que hay que conceder lectura explícita.
-- La RLS de las tablas subyacentes sigue aplicando gracias a security_invoker.
-- =========================================================================
grant select on public.races_view to authenticated;
grant select on public.season_standings to authenticated;

-- `anon` no accede a nada de la aplicación.
revoke all on public.races_view from anon;
revoke all on public.season_standings from anon;
