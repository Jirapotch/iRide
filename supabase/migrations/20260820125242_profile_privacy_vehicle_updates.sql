alter table public.profiles
  add column cover_path text check (char_length(cover_path) <= 500),
  add column is_private boolean not null default false;

alter table public.vehicles
  alter column make drop not null,
  alter column model drop not null,
  alter column year drop not null;

alter table public.follows
  add column status text not null default 'accepted'
  check (status in ('pending', 'accepted'));

create index follows_following_status_idx
  on public.follows(following_id, status, created_at, follower_id);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.can_view_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.profiles as target_profile
      where target_profile.id = target
        and (
          not target_profile.is_private
          or target_profile.id = (select auth.uid())
          or exists (
            select 1
            from public.follows as relationship
            where relationship.follower_id = (select auth.uid())
              and relationship.following_id = target_profile.id
              and relationship.status = 'accepted'
          )
        )
    ),
    false
  );
$$;

revoke all on function private.can_view_profile(uuid) from public, anon, authenticated, service_role;
grant execute on function private.can_view_profile(uuid) to anon, authenticated, service_role;

drop policy if exists "vehicles public read" on public.vehicles;
drop policy if exists "members read vehicles" on public.vehicles;
create policy "members read visible vehicles"
on public.vehicles for select to authenticated
using ((select private.can_view_profile(owner_id)));

drop policy if exists "members read posts" on public.posts;
create policy "members read visible posts"
on public.posts for select to authenticated
using ((select private.can_view_profile(author_id)));

drop policy if exists "members read comments" on public.comments;
create policy "members read visible comments"
on public.comments for select to authenticated
using (
  exists (
    select 1 from public.posts
    where public.posts.id = comments.post_id
  )
);

drop policy if exists "members read likes" on public.likes;
create policy "members read visible likes"
on public.likes for select to authenticated
using (
  exists (
    select 1 from public.posts
    where public.posts.id = likes.post_id
  )
);

drop policy if exists "members read follows" on public.follows;
drop policy if exists "follows own insert" on public.follows;
drop policy if exists "follows own delete" on public.follows;

create policy "participants read follows"
on public.follows for select to authenticated
using (
  (select auth.uid()) = follower_id
  or (select auth.uid()) = following_id
);

create policy "followers create requests"
on public.follows for insert to authenticated
with check (
  (select auth.uid()) = follower_id
  and follower_id <> following_id
  and status = (
    select case when profile.is_private then 'pending' else 'accepted' end
    from public.profiles as profile
    where profile.id = following_id
  )
);

create policy "profile owners accept requests"
on public.follows for update to authenticated
using ((select auth.uid()) = following_id and status = 'pending')
with check ((select auth.uid()) = following_id and status = 'accepted');

create policy "participants delete follows"
on public.follows for delete to authenticated
using (
  (select auth.uid()) = follower_id
  or (select auth.uid()) = following_id
);

create or replace function public.profile_stats(target uuid)
returns table (followers_count bigint, following_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      select count(*) from public.follows
      where following_id = target and status = 'accepted'
    ),
    (
      select count(*) from public.follows
      where follower_id = target and status = 'accepted'
    );
$$;

revoke all on function public.profile_stats(uuid) from public, anon, authenticated, service_role;
grant execute on function public.profile_stats(uuid) to authenticated, service_role;

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
  where (select private.can_view_profile(author.id))
  order by post.created_at desc, post.id desc
  limit least(greatest(coalesce(feed_limit, 20), 1), 50);
$$;

revoke all on function public.feed_posts(integer) from public, anon, authenticated, service_role;
grant execute on function public.feed_posts(integer) to anon, authenticated, service_role;
