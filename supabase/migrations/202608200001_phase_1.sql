create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._]{3,30}$'),
  display_name text not null check (char_length(display_name) between 2 and 60),
  bio text check (char_length(bio) <= 180),
  location text check (char_length(location) <= 80),
  avatar_path text check (char_length(avatar_path) <= 500),
  locale text not null default 'th' check (locale in ('th', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  make text not null check (char_length(make) between 1 and 50),
  model text not null check (char_length(model) between 1 and 50),
  year integer not null check (year between 1886 and 2200),
  trim text check (char_length(trim) <= 60),
  color text check (char_length(color) <= 60),
  description text check (char_length(description) <= 300),
  cover_path text check (char_length(cover_path) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 1200),
  photo_path text check (char_length(photo_path) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index vehicles_owner_created_idx on public.vehicles(owner_id, created_at, id);
create index posts_created_idx on public.posts(created_at desc, id desc);
create index posts_author_created_idx on public.posts(author_id, created_at desc, id desc);
create index posts_vehicle_created_idx on public.posts(vehicle_id, created_at desc, id desc) where vehicle_id is not null;
create index comments_post_created_idx on public.comments(post_id, created_at, id);
create index comments_author_created_idx on public.comments(author_id, created_at desc, id desc);
create index likes_post_created_idx on public.likes(post_id, created_at, user_id);
create index follows_following_created_idx on public.follows(following_id, created_at, follower_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger vehicles_touch before update on public.vehicles for each row execute function public.touch_updated_at();
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();
create trigger comments_touch before update on public.comments for each row execute function public.touch_updated_at();

create or replace function public.ensure_post_vehicle_owner()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.vehicle_id is not null and not exists (
    select 1 from public.vehicles where id = new.vehicle_id and owner_id = new.author_id
  ) then
    raise exception 'The selected vehicle must belong to the post author' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger posts_vehicle_owner_guard
before insert or update of author_id, vehicle_id on public.posts
for each row execute function public.ensure_post_vehicle_owner();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name, avatar_path)
  values (
    new.id,
    'driver.' || substring(replace(new.id::text, '-', ''), 1, 23),
    left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'New driver'), 60),
    null
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.profile_stats(target uuid)
returns table (followers_count bigint, following_count bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.follows where following_id = target),
    (select count(*) from public.follows where follower_id = target);
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.ensure_post_vehicle_owner() from public, anon, authenticated, service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.profile_stats(uuid) from public, anon, authenticated, service_role;
grant execute on function public.profile_stats(uuid) to anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;

-- Data API exposure is opt-in on new Supabase projects. Grants define which
-- operations can reach RLS; policies below still decide which rows are allowed.
grant usage on schema public to anon, authenticated, service_role;
grant select on table public.profiles, public.vehicles to anon;
grant select on table public.profiles, public.vehicles, public.posts, public.comments, public.likes, public.follows to authenticated;
grant insert, update on table public.profiles to authenticated;
grant insert, update, delete on table public.vehicles, public.posts, public.comments to authenticated;
grant insert, delete on table public.likes, public.follows to authenticated;
grant all privileges on table public.profiles, public.vehicles, public.posts, public.comments, public.likes, public.follows to service_role;

create policy "profiles public read" on public.profiles for select to anon, authenticated using (true);
create policy "profiles own insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles own update" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "vehicles public read" on public.vehicles for select to anon, authenticated using (true);
create policy "vehicles own insert" on public.vehicles for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "vehicles own update" on public.vehicles for update to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "vehicles own delete" on public.vehicles for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "members read posts" on public.posts for select to authenticated using (true);
create policy "posts own insert" on public.posts for insert to authenticated with check (
  (select auth.uid()) = author_id and (
    vehicle_id is null or exists (
      select 1 from public.vehicles where id = vehicle_id and owner_id = (select auth.uid())
    )
  )
);
create policy "posts own update" on public.posts for update to authenticated
using ((select auth.uid()) = author_id) with check (
  (select auth.uid()) = author_id and (
    vehicle_id is null or exists (
      select 1 from public.vehicles where id = vehicle_id and owner_id = (select auth.uid())
    )
  )
);
create policy "posts own delete" on public.posts for delete to authenticated using ((select auth.uid()) = author_id);

create policy "members read comments" on public.comments for select to authenticated using (true);
create policy "comments own insert" on public.comments for insert to authenticated with check (
  (select auth.uid()) = author_id and exists (select 1 from public.posts where id = post_id)
);
create policy "comments own update" on public.comments for update to authenticated
using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "comments own delete" on public.comments for delete to authenticated using ((select auth.uid()) = author_id);

create policy "members read likes" on public.likes for select to authenticated using (true);
create policy "likes own insert" on public.likes for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (select 1 from public.posts where id = post_id)
);
create policy "likes own delete" on public.likes for delete to authenticated using ((select auth.uid()) = user_id);

create policy "members read follows" on public.follows for select to authenticated using (true);
create policy "follows own insert" on public.follows for insert to authenticated with check ((select auth.uid()) = follower_id);
create policy "follows own delete" on public.follows for delete to authenticated using ((select auth.uid()) = follower_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('vehicle-media', 'vehicle-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-media', 'post-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public profile media read" on storage.objects for select to anon, authenticated
using (bucket_id in ('avatars', 'vehicle-media'));
create policy "member post media read" on storage.objects for select to authenticated using (bucket_id = 'post-media');
create policy "users upload own media" on storage.objects for insert to authenticated with check (
  bucket_id in ('avatars', 'vehicle-media', 'post-media')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "users update own media" on storage.objects for update to authenticated
using (
  bucket_id in ('avatars', 'vehicle-media', 'post-media')
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id in ('avatars', 'vehicle-media', 'post-media')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "users delete own media" on storage.objects for delete to authenticated using (
  bucket_id in ('avatars', 'vehicle-media', 'post-media')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
