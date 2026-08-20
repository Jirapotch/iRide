alter table public.profiles
  add column provider_avatar_url text,
  add column onboarding_completed boolean not null default false;

alter table public.profiles
  add constraint profiles_provider_avatar_url_check check (
    provider_avatar_url is null or (
      char_length(provider_avatar_url) <= 2048
      and provider_avatar_url ~ '^https://lh3\.googleusercontent\.com/'
    )
  );

update public.profiles as profile
set provider_avatar_url = left(
  coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(auth_user.raw_user_meta_data ->> 'picture', '')
  ),
  2048
)
from auth.users as auth_user
where auth_user.id = profile.id
  and auth_user.raw_app_meta_data ->> 'provider' = 'google'
  and profile.avatar_path is null
  and coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(auth_user.raw_user_meta_data ->> 'picture', '')
  ) ~ '^https://lh3\.googleusercontent\.com/';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_display_name text;
  candidate_avatar_url text;
begin
  candidate_display_name := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  if char_length(candidate_display_name) < 2 then
    candidate_display_name := 'New driver';
  end if;

  candidate_avatar_url := coalesce(
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'picture', '')
  );
  if new.raw_app_meta_data ->> 'provider' is distinct from 'google'
    or candidate_avatar_url !~ '^https://lh3\.googleusercontent\.com/' then
    candidate_avatar_url := null;
  end if;

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_path,
    provider_avatar_url,
    onboarding_completed
  )
  values (
    new.id,
    'driver.' || substring(replace(new.id::text, '-', ''), 1, 23),
    left(candidate_display_name, 60),
    null,
    left(candidate_avatar_url, 2048),
    false
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;

create or replace function public.feed_posts(feed_limit integer default 20)
returns table (
  id uuid,
  body text,
  photo_path text,
  created_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  author_provider_avatar_url text,
  vehicle_id uuid,
  vehicle_nickname text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  likes_count bigint,
  comments_count bigint,
  liked_by_viewer boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    post.id,
    post.body,
    post.photo_path,
    post.created_at,
    author.username,
    author.display_name,
    author.avatar_path,
    author.provider_avatar_url,
    vehicle.id,
    vehicle.nickname,
    vehicle.make,
    vehicle.model,
    vehicle.year,
    (select count(*) from public.likes as post_like where post_like.post_id = post.id),
    (select count(*) from public.comments as post_comment where post_comment.post_id = post.id),
    coalesce(
      exists (
        select 1
        from public.likes as viewer_like
        where viewer_like.post_id = post.id
          and viewer_like.user_id = (select auth.uid())
      ),
      false
    )
  from public.posts as post
  join public.profiles as author on author.id = post.author_id
  left join public.vehicles as vehicle on vehicle.id = post.vehicle_id
  order by post.created_at desc, post.id desc
  limit least(greatest(coalesce(feed_limit, 20), 1), 50);
$$;

revoke all on function public.feed_posts(integer) from public, anon, authenticated, service_role;
grant execute on function public.feed_posts(integer) to anon, authenticated, service_role;

revoke select on table
  public.profiles,
  public.vehicles,
  public.posts,
  public.comments,
  public.likes,
  public.follows
from anon;

drop policy if exists "profiles public read" on public.profiles;
create policy "members read profiles"
on public.profiles for select to authenticated using (true);

drop policy if exists "vehicles public read" on public.vehicles;
create policy "members read vehicles"
on public.vehicles for select to authenticated using (true);

revoke execute on function public.profile_stats(uuid) from anon;
