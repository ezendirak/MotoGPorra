-- ---------------------------------------------------------------------------
-- Puntuación por COMBINACIÓN de aciertos, no por acierto suelto.
--
-- La regla anterior era «1 punto por posición acertada», aditiva y simétrica.
-- La nueva pondera qué posiciones se aciertan y premia las combinaciones:
--
--     1-2-3 = 15      1-X-X =  5      X-X-3 =  1
--     1-2-X = 10      X-2-3 =  3      X-X-X =  0
--     1-X-3 =  7      X-2-X =  2
--
-- NO es aditiva: acertar 1º y 2º da 10, mientras que 5+2 sería 7. Por eso se
-- guarda como tabla de consulta y no como valor por posición — cualquier
-- intento de expresarla como suma daría números distintos a los acordados.
--
-- La clave es el patrón de aciertos leído de izquierda a derecha: '110' es
-- acertar 1º y 2º y fallar 3º. Un patrón ausente vale 0, así que '000' no
-- hace falta declararlo.
-- ---------------------------------------------------------------------------

alter table public.scoring_rules
  add column if not exists points_by_pattern jsonb not null default
    '{"111":15,"110":10,"101":7,"100":5,"011":3,"010":2,"001":1}'::jsonb;

comment on column public.scoring_rules.points_by_pattern is
  'Puntos por patrón de aciertos. Clave de 3 caracteres, 1=acierto y 0=fallo, en orden 1º-2º-3º. Ausente = 0 puntos.';

-- Las dos columnas anteriores dejan de influir en nada. Se eliminan en vez de
-- dejarlas a cero: una regla que ya no se aplica pero sigue en el esquema es
-- exactamente lo que hace que alguien la cambie dentro de un año esperando que
-- pase algo.
alter table public.scoring_rules drop column if exists points_exact_position;
alter table public.scoring_rules drop column if exists points_podium_any;

-- ---------------------------------------------------------------------------
-- Recálculo, ahora por patrón.
--
-- Se mantiene todo lo demás igual: sigue siendo RECALCULABLE y no incremental,
-- sigue limpiando si el resultado oficial desaparece, y sigue borrando a quien
-- ya no tiene apuesta.
-- ---------------------------------------------------------------------------
create or replace function public.recalculate_race_scores(p_race_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows     integer;
  v_tabla    jsonb;
  v_oficial  boolean;
begin
  select exists (
    select 1 from public.race_results rr
    where rr.race_id = p_race_id and rr.status = 'official'
  ) into v_oficial;

  if not v_oficial then
    delete from public.race_scores rs where rs.race_id = p_race_id;
    return 0;
  end if;

  select sr.points_by_pattern into v_tabla
  from public.scoring_rules sr
  join public.races r on r.season_id = sr.season_id
  where r.id = p_race_id;

  -- Sin reglas para la temporada se aplica la tabla acordada, para que una
  -- temporada nueva sin configurar no puntúe a cero en silencio.
  v_tabla := coalesce(
    v_tabla,
    '{"111":15,"110":10,"101":7,"100":5,"011":3,"010":2,"001":1}'::jsonb
  );

  with podium as (
    select e.position, e.rider_id
    from public.race_result_entries e
    join public.race_results rr on rr.id = e.race_result_id
    where rr.race_id = p_race_id
      and rr.status = 'official'
      and e.is_classified
      and e.position between 1 and 3
  ),
  aciertos as (
    select
      b.user_id,
      max(case when bp.position = 1 and p.rider_id is not null then 1 else 0 end) as a1,
      max(case when bp.position = 2 and p.rider_id is not null then 1 else 0 end) as a2,
      max(case when bp.position = 3 and p.rider_id is not null then 1 else 0 end) as a3,
      jsonb_object_agg(bp.position::text, p.rider_id is not null) as breakdown
    from public.bets b
    join public.bet_picks bp on bp.bet_id = b.id
    left join podium p on p.position = bp.position and p.rider_id = bp.rider_id
    where b.race_id = p_race_id
    group by b.user_id
  )
  insert into public.race_scores (race_id, user_id, points, exact_hits, breakdown, computed_at)
  select
    p_race_id,
    a.user_id,
    coalesce((v_tabla ->> (a.a1::text || a.a2::text || a.a3::text))::smallint, 0),
    (a.a1 + a.a2 + a.a3)::smallint,
    a.breakdown,
    now()
  from aciertos a
  on conflict (race_id, user_id) do update
    set points      = excluded.points,
        exact_hits  = excluded.exact_hits,
        breakdown   = excluded.breakdown,
        computed_at = now();

  get diagnostics v_rows = row_count;

  delete from public.race_scores rs
  where rs.race_id = p_race_id
    and not exists (
      select 1 from public.bets b
      where b.race_id = p_race_id and b.user_id = rs.user_id
    );

  return v_rows;
end;
$$;

revoke all on function public.recalculate_race_scores(uuid) from public, anon, authenticated;
grant execute on function public.recalculate_race_scores(uuid) to service_role;
