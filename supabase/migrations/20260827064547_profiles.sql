create type public.profile_visibility as enum ('public', 'followers', 'private');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_media_id uuid,
  cover_media_id uuid,
  location_name text,
  latitude double precision,
  longitude double precision,
  visibility public.profile_visibility not null default 'public',
  username_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null or username ~ '^[a-z0-9][a-z0-9_]{2,29}$'
  ),
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 80
  ),
  constraint profiles_bio_length check (
    bio is null or char_length(bio) <= 500
  ),
  constraint profiles_location_name_length check (
    location_name is null or char_length(location_name) <= 120
  ),
  constraint profiles_coordinates_pair check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  ),
  constraint profiles_latitude_range check (
    latitude is null or latitude between -90 and 90
  ),
  constraint profiles_longitude_range check (
    longitude is null or longitude between -180 and 180
  )
);

comment on table public.profiles is
  'Editable public identity for an auth user. Sensitive auth data never belongs here.';
comment on column public.profiles.avatar_media_id is
  'Reserved media UUID. The foreign key and mutation path are added with the media schema.';
comment on column public.profiles.cover_media_id is
  'Reserved media UUID. The foreign key and mutation path are added with the media schema.';
comment on column public.profiles.visibility is
  'followers is temporarily public until the follows relation is introduced in Step 09.';

create index profiles_visibility_idx on public.profiles (visibility);

create or replace function private.profile_username_is_reserved(candidate text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select candidate = any (array[
    'account', 'api', 'auth', 'login', 'logout', 'onboarding',
    'profile', 'profiles', 'users', 'feed', 'explore', 'garage',
    'events', 'communities', 'photographers', 'marketplace', 'cart',
    'orders', 'settings', 'admin', 'support', 'help', 'about',
    'terms', 'privacy', 'iride', 'th', 'en'
  ]::text[]);
$$;

create or replace function private.prepare_profile_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.username = nullif(lower(btrim(new.username)), '');
  new.display_name = nullif(btrim(new.display_name), '');
  new.bio = nullif(btrim(new.bio), '');
  new.location_name = nullif(btrim(new.location_name), '');

  if new.username is not null and private.profile_username_is_reserved(new.username) then
    raise exception using errcode = '23514', message = 'username_reserved';
  end if;

  if tg_op = 'UPDATE' and new.username is distinct from old.username then
    if old.username is not null and new.username is null then
      raise exception using errcode = '23514', message = 'username_required';
    end if;

    if old.username is not null
      and old.username_changed_at is not null
      and old.username_changed_at > now() - interval '30 days'
    then
      raise exception using errcode = 'P0001', message = 'username_cooldown';
    end if;

    new.username_changed_at = case
      when new.username is null then null
      else now()
    end;
  end if;

  return new;
end;
$$;

create trigger prepare_profile_write
before insert or update on public.profiles
for each row execute function private.prepare_profile_write();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

revoke all on function private.profile_username_is_reserved(text) from public, anon, authenticated, service_role;
revoke all on function private.prepare_profile_write() from public, anon, authenticated, service_role;
revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select (
  id, username, display_name, bio, avatar_media_id, cover_media_id,
  location_name, visibility, created_at, updated_at
) on table public.profiles to anon, authenticated;
grant update (
  username, display_name, bio, location_name, latitude, longitude, visibility
) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy profiles_select_visible_or_owner
on public.profiles
for select
to anon, authenticated
using (
  (
    username is not null
    and display_name is not null
    and visibility in ('public', 'followers')
  )
  or (select auth.uid()) = id
);

create policy profiles_update_owner
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
