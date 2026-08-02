-- =========================================================================
-- Extensiones, esquema interno y utilidades comunes.
--
-- El esquema `internal` NO se expone por la Data API: aquí viven funciones
-- auxiliares y disparadores que ningún cliente debe poder invocar.
-- Ver docs/DESIGN.md §4.1.
-- =========================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists internal;

-- `internal` no se expone por la Data API — eso lo controla la lista de
-- esquemas expuestos, no los GRANT. Pero SÍ hace falta conceder USAGE a
-- `authenticated`: las políticas RLS y los triggers invocan funciones de este
-- esquema, y se evalúan con los permisos de quien consulta. Sin USAGE, toda
-- política que llame a internal.is_admin() fallaría con "permission denied".
revoke all on schema internal from public;
grant usage on schema internal to authenticated;

-- -------------------------------------------------------------------------
-- Mantiene `updated_at` sin depender de que la aplicación se acuerde.
-- -------------------------------------------------------------------------
create or replace function internal.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function internal.set_updated_at() is
  'Trigger BEFORE UPDATE: refresca updated_at en cada modificación.';

-- Un trigger corre con los permisos de quien ejecuta la operación: sin este
-- GRANT, un usuario actualizando su propio perfil recibiría "permission
-- denied for function set_updated_at".
grant execute on function internal.set_updated_at() to authenticated;
