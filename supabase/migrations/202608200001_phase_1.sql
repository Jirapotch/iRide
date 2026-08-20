create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._]{3,30}$'),
  display_name text not null check (char_length(display_name) between 2 and 60),
  bio text check (char_length(bio) <= 180),
  location text check (char_length(location) <= 80),
  avatar_url text,
  locale text not null default 'th' check (locale in ('th', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40), make text not null check (char_length(make) <= 50),
  model text not null check (char_length(model) <= 50), year int not null check (year between 1886 and 2200),
  trim text check (char_length(trim) <= 60), color text check (char_length(color) <= 60),
  description text check (char_length(description) <= 300), cover_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null, body text not null check (char_length(body) between 1 and 1200),
  photo_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade, body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade, post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, post_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (follower_id, following_id), check (follower_id <> following_id)
);

create index posts_created_at_idx on public.posts(created_at desc, id desc);
create index comments_post_created_idx on public.comments(post_id, created_at);
create index vehicles_owner_idx on public.vehicles(owner_id);
create index follows_following_idx on public.follows(following_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger vehicles_touch before update on public.vehicles for each row execute function public.touch_updated_at();
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();
create trigger comments_touch before update on public.comments for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, 'driver.' || substring(new.id::text, 1, 8), coalesce(new.raw_user_meta_data ->> 'full_name', 'New driver'), new.raw_user_meta_data ->> 'avatar_url');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.profile_stats(target uuid)
returns table (followers_count bigint, following_count bigint)
language sql stable security invoker set search_path = '' as $$
  select (select count(*) from public.follows where following_id = target),
         (select count(*) from public.follows where follower_id = target);
$$;

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;

create policy "profiles public read" on public.profiles for select to anon, authenticated using (true);
create policy "profiles own insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles own update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "vehicles public read" on public.vehicles for select to anon, authenticated using (true);
create policy "vehicles own insert" on public.vehicles for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "vehicles own update" on public.vehicles for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "vehicles own delete" on public.vehicles for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "members read posts" on public.posts for select to authenticated using (true);
create policy "posts own insert" on public.posts for insert to authenticated with check ((select auth.uid()) = author_id and (vehicle_id is null or exists (select 1 from public.vehicles where id = vehicle_id and owner_id = (select auth.uid()))));
create policy "posts own update" on public.posts for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "posts own delete" on public.posts for delete to authenticated using ((select auth.uid()) = author_id);
create policy "members read comments" on public.comments for select to authenticated using (true);
create policy "comments own insert" on public.comments for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "comments own update" on public.comments for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "comments own delete" on public.comments for delete to authenticated using ((select auth.uid()) = author_id);
create policy "members read likes" on public.likes for select to authenticated using (true);
create policy "likes own insert" on public.likes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "likes own delete" on public.likes for delete to authenticated using ((select auth.uid()) = user_id);
create policy "members read follows" on public.follows for select to authenticated using (true);
create policy "follows own insert" on public.follows for insert to authenticated with check ((select auth.uid()) = follower_id);
create policy "follows own delete" on public.follows for delete to authenticated using ((select auth.uid()) = follower_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 8388608, array['image/jpeg','image/png','image/webp']),
  ('vehicle-media', 'vehicle-media', true, 8388608, array['image/jpeg','image/png','image/webp']),
  ('post-media', 'post-media', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "public avatar read" on storage.objects for select to anon, authenticated using (bucket_id in ('avatars','vehicle-media'));
create policy "member post media read" on storage.objects for select to authenticated using (bucket_id = 'post-media');
create policy "users upload own media" on storage.objects for insert to authenticated with check (bucket_id in ('avatars','vehicle-media','post-media') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users update own media" on storage.objects for update to authenticated using ((storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete own media" on storage.objects for delete to authenticated using ((storage.foldername(name))[1] = (select auth.uid())::text);
