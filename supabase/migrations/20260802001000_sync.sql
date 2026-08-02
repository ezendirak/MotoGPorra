-- =========================================================================
-- Auditoría del sincronizador. Ver docs/DESIGN.md §4.11.
--
-- Permite reconstruir qué pasó en cada ejecución y, junto con
-- `race_results.raw_payload`, reprocesar sin volver a llamar a MotoGP.
-- =========================================================================

create table public.sync_runs (
  id           uuid primary key default gen_random_uuid(),
  job          public.sync_job not null,
  state        public.sync_state not null default 'running',
  season_id    uuid references public.seasons(id) on delete set null,
  -- null = ejecución automática por cron; con valor = disparo manual del admin.
  triggered_by uuid references auth.users(id) on delete set null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  stats        jsonb not null default '{}'::jsonb,
  error        text
);

create index sync_runs_started_idx on public.sync_runs (started_at desc);
create index sync_runs_job_idx on public.sync_runs (job, started_at desc);
