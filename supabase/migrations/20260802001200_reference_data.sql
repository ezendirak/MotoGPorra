-- =========================================================================
-- Datos de referencia imprescindibles para que la aplicación arranque.
--
-- Va en una migración y no en seed.sql a propósito: `seed.sql` solo se ejecuta
-- en el entorno local (`supabase db reset`), mientras que sin categorías ni
-- temporada activa el alta de usuarios no puede inscribir a nadie. Esto es
-- estructura, no datos de prueba.
--
-- Idempotente: se puede reejecutar sin duplicar nada.
-- =========================================================================

-- Las categorías se identifican por `code`. Los UUID de categoría de MotoGP
-- NO se fijan aquí: la API usa espacios de identificadores distintos según el
-- endpoint (el del calendario no coincide con el de /riders ni con el de
-- resultados), así que los rellena y reconcilia el sincronizador.
insert into public.categories (code, name, sort_order) values
  ('MOTOGP', 'MotoGP', 1),
  ('MOTO2',  'Moto2',  2),
  ('MOTO3',  'Moto3',  3),
  ('MOTOE',  'MotoE',  4)
on conflict (code) do nothing;

-- Temporada en curso. Solo se apuesta en MotoGP (decisión 1); el resto de
-- categorías existen para no tener que migrar cuando se amplíe.
insert into public.seasons (year, name, is_active) values
  (2026, 'Temporada 2026', true)
on conflict (year) do nothing;

-- 1 punto por posición acertada, igual en sprint y en carrera (decisión 8).
insert into public.scoring_rules (season_id, points_exact_position, points_podium_any)
select s.id, 1, 0
from public.seasons s
where s.year = 2026
on conflict (season_id) do nothing;
