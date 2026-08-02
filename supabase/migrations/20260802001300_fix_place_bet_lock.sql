-- =========================================================================
-- Corrección: `place_bet` fallaba siempre con RACE_NOT_FOUND.
--
-- CAUSA
-- La función leía la carrera con `SELECT ... FOR SHARE` como red de seguridad
-- contra modificaciones concurrentes. Pero bajo RLS, PostgreSQL evalúa las
-- políticas de UPDATE además de las de SELECT en cualquier consulta con
-- cláusula de bloqueo: bloquear una fila se considera una intención de
-- modificarla.
--
-- `races` solo tiene política de UPDATE para administradores
-- (`races_admin_update`), así que para un jugador normal la consulta no
-- devolvía ninguna fila y la función abortaba con RACE_NOT_FOUND — aunque la
-- carrera existiera y estuviera abierta.
--
-- SOLUCIÓN
-- Quitar el bloqueo. No hacía falta: la ventana temporal la valida
-- `internal.is_betting_open()` (SECURITY DEFINER, lee `races` sin depender de
-- la RLS del invocador), y la política RLS de INSERT sobre `bets` la vuelve a
-- comprobar en el momento de escribir. Son dos verificaciones independientes
-- dentro de la misma transacción; un `FOR SHARE` solo protegería contra que
-- un administrador cambiara el cierre en los microsegundos intermedios.
-- =========================================================================

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

  -- Sin FOR SHARE: ver la explicación de la cabecera.
  select * into v_race from public.races r where r.id = p_race_id;
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

  delete from public.bet_picks bp where bp.bet_id = v_bet_id;

  insert into public.bet_picks (bet_id, position, rider_id)
  select v_bet_id, t.ord::smallint, t.rid
  from unnest(p_rider_ids) with ordinality as t(rid, ord);

  return v_bet_id;
end;
$$;

revoke all on function public.place_bet(uuid, uuid[]) from public, anon;
grant execute on function public.place_bet(uuid, uuid[]) to authenticated;
