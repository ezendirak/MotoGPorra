-- =========================================================================
-- Perfiles, roles, participación por temporada y alta automática de usuario.
-- Ver docs/DESIGN.md §4.7 y §7.
--
-- El email NO se duplica aquí: vive en auth.users y se lee de la sesión.
-- Duplicarlo obligaría a sincronizarlo en cada cambio y lo expondría por la
-- Data API sin necesidad.
-- =========================================================================

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Nombres visibles únicos sin distinguir mayúsculas: en una porra, dos
-- "Marc" en la clasificación es una fuente garantizada de discusiones.
create unique index profiles_display_name_uk on public.profiles (lower(display_name));

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function internal.set_updated_at();

create table public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       public.app_role not null default 'player',
  created_at timestamptz not null default now()
);

create table public.season_participants (
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (season_id, user_id)
);

-- -------------------------------------------------------------------------
-- ¿Es administrador el usuario actual?
--
-- Dos caminos, en este orden:
--   1. Claim `app_role` del JWT — instantáneo, sin consulta por fila. Requiere
--      tener activado el Custom Access Token Hook.
--   2. Respaldo: consulta directa a user_roles. SECURITY DEFINER evita la
--      recursión infinita de RLS que provocaría un EXISTS normal sobre una
--      tabla que a su vez tiene RLS.
--
-- El respaldo existe para que un hook mal configurado no deje al
-- administrador fuera de su propia aplicación.
-- -------------------------------------------------------------------------
create or replace function internal.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claim text;
begin
  if auth.uid() is null then
    return false;
  end if;

  v_claim := coalesce(
    auth.jwt() -> 'app_metadata' ->> 'app_role',
    auth.jwt() ->> 'app_role'
  );

  if v_claim is not null then
    return v_claim = 'admin';
  end if;

  return exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  );
end;
$$;

revoke all on function internal.is_admin() from public, anon;
grant execute on function internal.is_admin() to authenticated;

-- -------------------------------------------------------------------------
-- Alta de usuario: garantiza que jamás exista un auth.users sin perfil ni rol.
--
-- Hacerlo desde el cliente dejaría usuarios a medio crear si el navegador se
-- cierra entre las dos llamadas. Aquí es atómico con el propio registro.
-- -------------------------------------------------------------------------
create or replace function internal.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base    text;
  v_name    text;
  v_suffix  integer := 0;
  v_season  uuid;
begin
  -- Nombre visible: el que pidió el usuario o, si no, el prefijo del email.
  v_base := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  if v_base is null then
    v_base := split_part(coalesce(new.email, ''), '@', 1);
  end if;
  v_base := left(regexp_replace(v_base, '\s+', ' ', 'g'), 40);

  if char_length(v_base) < 2 then
    v_base := 'piloto';
  end if;

  -- Resolver colisiones de nombre en vez de reventar el registro.
  v_name := v_base;
  while exists (
    select 1 from public.profiles p where lower(p.display_name) = lower(v_name)
  ) loop
    v_suffix := v_suffix + 1;
    v_name := left(v_base, 36) || '-' || v_suffix::text;
  end loop;

  insert into public.profiles (id, display_name)
  values (new.id, v_name)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'player')
  on conflict (user_id) do nothing;

  -- Inscripción automática en la temporada activa (registro abierto).
  select s.id into v_season from public.seasons s where s.is_active limit 1;
  if v_season is not null then
    insert into public.season_participants (season_id, user_id)
    values (v_season, new.id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function internal.handle_new_user();
