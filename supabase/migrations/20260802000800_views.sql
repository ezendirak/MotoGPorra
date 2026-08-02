-- =========================================================================
-- Vistas derivadas. Ver docs/DESIGN.md §4.6 y §4.10.
--
-- IMPORTANTE: ambas se crean con `security_invoker = true`. Por defecto una
-- vista se ejecuta con los permisos de su propietario, lo que haría que
-- BYPASEARA la RLS de las tablas subyacentes — un agujero de seguridad
-- silencioso. Con security_invoker se aplican las políticas del usuario que
-- consulta, que es justo lo que queremos.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Estado de la carrera: DERIVADO, nunca almacenado.
--
-- La alternativa (una columna `status` actualizada por un cron) abre una
-- ventana en la que la base de datos miente: si el cron falla, las apuestas
-- siguen abiertas después del cierre. Derivándolo, la regla es inviolable.
-- `status_override` cubre el "abrir o cerrar excepcionalmente" del admin.
-- -------------------------------------------------------------------------
create view public.races_view
with (security_invoker = true)
as
select
  r.id,
  r.season_id,
  r.event_id,
  r.category_id,
  r.session_id,
  r.kind,
  r.scheduled_at,
  r.closes_at,
  r.is_cancelled,
  e.name          as event_name,
  e.short_name    as event_short_name,
  e.round,
  e.country_code,
  e.time_zone,
  c.name          as circuit_name,
  c.city          as circuit_city,
  c.country_name  as circuit_country,
  c.layout_svg_url,
  cat.code        as category_code,
  cat.name        as category_name,
  (res.id is not null and res.status = 'official') as has_official_result,
  coalesce(
    r.status_override,
    case
      when r.is_cancelled then 'cancelled'
      when res.id is not null and res.status = 'official' then 'finished'
      -- `upcoming` = el calendario ya tiene el GP pero aún no se han
      -- importado sus sesiones, así que no se conoce la hora de cierre.
      when r.closes_at is null then 'upcoming'
      when now() >= r.closes_at then 'closed'
      else 'open'
    end::public.race_status
  ) as status
from public.races r
join public.events e on e.id = r.event_id
join public.categories cat on cat.id = r.category_id
left join public.circuits c on c.id = e.circuit_id
left join public.race_results res on res.race_id = r.id;

comment on view public.races_view is
  'Carreras con su estado calculado en tiempo real. El frontend siempre lee de aquí, nunca de `races` directamente.';

-- -------------------------------------------------------------------------
-- Clasificación general.
--
-- `rank()` produce empates compartidos de forma natural (1, 2, 2, 4), que es
-- exactamente la regla acordada: no hay criterio de desempate. `exact_hits`
-- se expone como dato informativo, no ordena.
-- -------------------------------------------------------------------------
create view public.season_standings
with (security_invoker = true)
as
select
  r.season_id,
  s.user_id,
  p.display_name,
  p.avatar_url,
  sum(s.points)::integer      as total_points,
  sum(s.exact_hits)::integer  as total_exact_hits,
  count(*)::integer           as races_played,
  cast(
    rank() over (partition by r.season_id order by sum(s.points) desc)
    as integer
  ) as position
from public.race_scores s
join public.races r on r.id = s.race_id
join public.profiles p on p.id = s.user_id
group by r.season_id, s.user_id, p.display_name, p.avatar_url;

comment on view public.season_standings is
  'Clasificación general derivada de race_scores. Vista y no tabla materializada: con ~20 usuarios × 44 carreras el agregado es instantáneo y siempre coherente.';
