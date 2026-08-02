-- =========================================================================
-- Tipos enumerados. Ver docs/DESIGN.md §4.2.
--
-- Nota: NO existe un enum `finish_status`. La API de MotoGP solo distingue
-- entre clasificado ('INSTND') y no clasificado ('OUTSTND'); no diferencia
-- DNF, DNS ni DSQ. Un enum de cinco valores que nunca podríamos rellenar
-- sería mentir en el esquema (§4.9).
-- =========================================================================

create type public.race_status as enum (
  'upcoming',   -- aún lejos: las apuestas ni siquiera están abiertas
  'open',       -- se puede apostar y modificar
  'closed',     -- cerrada: ya no se admite ni se modifica nada
  'finished',   -- hay resultado oficial importado
  'cancelled'
);

create type public.session_kind as enum (
  'fp', 'practice', 'qualifying', 'sprint', 'race', 'warmup', 'other'
);

create type public.result_status as enum ('provisional', 'official');

create type public.app_role as enum ('admin', 'player');

create type public.sync_job as enum (
  'calendar', 'riders', 'results', 'backfill', 'recalculate'
);

create type public.sync_state as enum ('running', 'success', 'failed', 'partial');
