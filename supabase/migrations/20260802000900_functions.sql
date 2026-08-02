-- =========================================================================
-- Funciones de negocio. Ver docs/DESIGN.md §8 y §9.
-- =========================================================================

-- -------------------------------------------------------------------------
-- ¿Están abiertas las apuestas de esta carrera?
--
-- FUENTE ÚNICA DE VERDAD. La usan tanto las políticas RLS como `place_bet`.
-- Si cada una implementara la regla por su cuenta, un `status_override` del
-- administrador podría dejar a la función permitiendo lo que la RLS rechaza.
--
-- SECURITY DEFINER para poder leer `races` sin depender de las políticas del
-- invocador; no expone nada, solo devuelve un booleano.
-- -------------------------------------------------------------------------
create or replace function internal.is_betting_open(p_race_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when r.is_cancelled then false
    when r.status_override = 'open' then true
    when r.status_override in ('closed', 'finished', 'cancelled') then false
    when r.closes_at is null then false
    else now() < r.closes_at
  end
  from public.races r
  where r.id = p_race_id;
$$;

revoke all on function internal.is_betting_open(uuid) from public, anon;
grant execute on function internal.is_betting_open(uuid) to authenticated;

-- -------------------------------------------------------------------------
-- Crear o modificar una apuesta.
--
-- Único camino de escritura. Una sola llamada, una sola transacción: con dos
-- peticiones (upsert de `bets` + insert de picks) un fallo de red dejaría una
-- apuesta con 0 ó 1 picks, violando la invariante de "exactamente 3".
--
-- SECURITY INVOKER: la función no eleva privilegios. La RLS sigue aplicando y
-- el usuario sigue sin poder tocar la apuesta de otro.
--
-- Los errores son códigos estables que la capa de servicios traduce.
-- -------------------------------------------------------------------------
create or replace function public.place_bet(p_race_id uuid, p_rider_ids uuid[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bet_id uuid;
  v_race   public.races%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_race from public.races r where r.id = p_race_id for share;
  if not found then
    raise exception 'RACE_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- El reloj del SERVIDOR decide. Un cliente con la hora adelantada no puede
  -- colar una apuesta tardía; la cuenta atrás de la UI es solo informativa.
  if not coalesce(internal.is_betting_open(p_race_id), false) then
    raise exception 'BETTING_CLOSED' using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_rider_ids, 1), 0) <> 3 then
    raise exception 'INVALID_PICK_COUNT' using errcode = 'P0001';
  end if;

  if (select count(distinct x) from unnest(p_rider_ids) as x) <> 3 then
    raise exception 'DUPLICATE_RIDER' using errcode = 'P0001';
  end if;

  -- Los tres pilotos deben estar inscritos y activos en ESA temporada y
  -- categoría: impide apostar por un piloto de Moto2 o por uno retirado.
  if (
    select count(*)
    from public.rider_season_entries e
    where e.rider_id = any (p_rider_ids)
      and e.season_id = v_race.season_id
      and e.category_id = v_race.category_id
      and e.is_active
  ) <> 3 then
    raise exception 'RIDER_NOT_IN_SEASON' using errcode = 'P0001';
  end if;

  insert into public.bets (race_id, user_id)
  values (p_race_id, auth.uid())
  on conflict (user_id, race_id) do update set updated_at = now()
  returning id into v_bet_id;

  -- Reemplazo completo: idempotente y sin estados intermedios visibles.
  delete from public.bet_picks bp where bp.bet_id = v_bet_id;

  insert into public.bet_picks (bet_id, position, rider_id)
  select v_bet_id, t.ord::smallint, t.rid
  from unnest(p_rider_ids) with ordinality as t(rid, ord);

  return v_bet_id;
end;
$$;

revoke all on function public.place_bet(uuid, uuid[]) from public, anon;
grant execute on function public.place_bet(uuid, uuid[]) to authenticated;

-- -------------------------------------------------------------------------
-- Recalcular las puntuaciones de una carrera.
--
-- Se invoca explícitamente al final de la transacción que importa el
-- resultado, NO mediante un trigger de tabla: un trigger se dispararía una
-- vez por cada una de las ~22 líneas del resultado, recalculando 22 veces
-- sobre datos incompletos.
--
-- Es RECALCULABLE, no incremental: si MotoGP revisa un resultado por sanción,
-- basta volver a llamarla y el estado queda idéntico a como si el resultado
-- anterior nunca hubiera existido.
-- -------------------------------------------------------------------------
create or replace function public.recalculate_race_scores(p_race_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows          integer;
  v_points_exact  smallint;
  v_points_any    smallint;
  v_has_official  boolean;
begin
  select exists (
    select 1 from public.race_results rr
    where rr.race_id = p_race_id and rr.status = 'official'
  ) into v_has_official;

  -- Sin resultado oficial no hay puntuación. Si antes la hubo (resultado
  -- retirado o degradado a provisional), se limpia: la clasificación nunca
  -- debe arrastrar puntos de un resultado que ya no existe.
  if not v_has_official then
    delete from public.race_scores rs where rs.race_id = p_race_id;
    return 0;
  end if;

  select sr.points_exact_position, sr.points_podium_any
    into v_points_exact, v_points_any
  from public.scoring_rules sr
  join public.races r on r.season_id = sr.season_id
  where r.id = p_race_id;

  -- Sin reglas configuradas para la temporada, se aplica la regla acordada.
  v_points_exact := coalesce(v_points_exact, 1);
  v_points_any   := coalesce(v_points_any, 0);

  with podium as (
    select e.position, e.rider_id
    from public.race_result_entries e
    join public.race_results rr on rr.id = e.race_result_id
    where rr.race_id = p_race_id
      and rr.status = 'official'
      and e.is_classified
      and e.position between 1 and 3
  ),
  scored as (
    select
      b.user_id,
      sum(
        case
          when exact.rider_id is not null then v_points_exact
          when anypos.rider_id is not null then v_points_any
          else 0
        end
      )::smallint as points,
      count(exact.rider_id)::smallint as exact_hits,
      jsonb_object_agg(bp.position::text, exact.rider_id is not null) as breakdown
    from public.bets b
    join public.bet_picks bp on bp.bet_id = b.id
    -- Acierto exacto: mismo piloto Y misma posición.
    left join podium exact on exact.position = bp.position and exact.rider_id = bp.rider_id
    -- Piloto en el podio pero en otra posición.
    left join podium anypos on anypos.rider_id = bp.rider_id
    where b.race_id = p_race_id
    group by b.user_id
  )
  insert into public.race_scores (race_id, user_id, points, exact_hits, breakdown, computed_at)
  select p_race_id, s.user_id, s.points, s.exact_hits, s.breakdown, now()
  from scored s
  on conflict (race_id, user_id) do update
    set points      = excluded.points,
        exact_hits  = excluded.exact_hits,
        breakdown   = excluded.breakdown,
        computed_at = now();

  get diagnostics v_rows = row_count;

  -- Usuarios que ya no tienen apuesta en esta carrera no deben conservar puntos.
  delete from public.race_scores rs
  where rs.race_id = p_race_id
    and not exists (
      select 1 from public.bets b
      where b.race_id = p_race_id and b.user_id = rs.user_id
    );

  return v_rows;
end;
$$;

-- Solo el sincronizador y el administrador recalculan. Nunca un jugador.
revoke all on function public.recalculate_race_scores(uuid) from public, anon, authenticated;
grant execute on function public.recalculate_race_scores(uuid) to service_role;
