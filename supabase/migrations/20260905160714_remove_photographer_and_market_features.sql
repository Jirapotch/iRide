-- Forward-only removal of photographer and Market domains.
-- The media worker must be paused before applying this migration and resumed after cleanup.

create temporary table removed_photographer_posts on commit drop as
  select id from public.posts where community_category = 'photographers'::text::public.community_category;
create temporary table removed_photographer_spots on commit drop as
  select id from public.photographer_spots;
create temporary table removed_market_media on commit drop as
  select id, original_object_key from public.media where purpose = 'market';

-- Queue deletion of every original and generated variant before deleting metadata.
select public.enqueue_job('media_cleanup', jsonb_build_object(
  'version', 1,
  'jobId', extensions.gen_random_uuid()::text,
  'idempotencyKey', 'feature-removal:market-media:' || m.id::text,
  'attempt', 1,
  'objectKeys', (
    select jsonb_agg(k.object_key order by k.object_key)
    from (
      select m.original_object_key as object_key
      union all select v.object_key from public.media_variants v where v.media_id = m.id
    ) k
  )
), 0)
from removed_market_media m;

delete from pgmq.q_media_processing
where message->>'purpose' = 'market';

delete from public.admin_audit_log
where target_table in ('photographer_spots', 'posts')
  and (target_table <> 'posts' or target_id in (select id from removed_photographer_posts));

delete from public.post_marker_tags
where photographer_spot_id in (select id from removed_photographer_spots)
   or post_id in (select id from removed_photographer_posts);

-- Comments have restrictive self-references, so remove leaves before their parents.
do $$
begin
  loop
    delete from public.comments c
    where c.post_id in (select id from removed_photographer_posts)
      and not exists (select 1 from public.comments child where child.parent_id = c.id);
    exit when not found;
  end loop;
end $$;
delete from public.posts where id in (select id from removed_photographer_posts);
delete from public.market_products;
delete from public.photographer_spots;
delete from public.media where id in (select id from removed_market_media);

drop function if exists public.save_post_with_markers(uuid, text, jsonb, public.community_category);
drop function if exists public.explore_content(double precision, double precision, double precision, double precision, text[]);

alter table public.post_marker_tags drop constraint if exists post_marker_tags_target;
alter table public.post_marker_tags drop constraint if exists post_marker_tags_photographer_spot_id_fkey;
drop policy if exists post_marker_tags_public_select on public.post_marker_tags;
drop policy if exists post_marker_tags_visible_select on public.post_marker_tags;
drop policy if exists post_marker_tags_owner_insert on public.post_marker_tags;
drop policy if exists post_marker_tags_owner_update on public.post_marker_tags;
drop policy if exists post_marker_tags_owner_delete on public.post_marker_tags;
drop index if exists public.post_marker_tags_unique_spot;
alter table public.post_marker_tags drop column if exists photographer_spot_id;
alter table public.post_marker_tags add constraint post_marker_tags_target check (event_id is not null);
create policy post_marker_tags_public_select on public.post_marker_tags for select to anon using (true);
create policy post_marker_tags_visible_select on public.post_marker_tags for select to authenticated using (true);
create policy post_marker_tags_owner_insert on public.post_marker_tags for insert to authenticated with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy post_marker_tags_owner_update on public.post_marker_tags for update to authenticated using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy post_marker_tags_owner_delete on public.post_marker_tags for delete to authenticated using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create type public.community_category_new as enum ('car', 'motorcycle', 'bicycle', 'groups');
alter table public.posts alter column community_category type public.community_category_new
  using community_category::text::public.community_category_new;
drop type public.community_category;
alter type public.community_category_new rename to community_category;

create type public.media_purpose_new as enum ('avatar', 'cover', 'vehicle');
alter table public.media alter column purpose type public.media_purpose_new
  using purpose::text::public.media_purpose_new;
drop type public.media_purpose;
alter type public.media_purpose_new rename to media_purpose;

create or replace function public.explore_content(
  west double precision, south double precision, east double precision, north double precision, layers text[]
)
returns table (id uuid, kind text, title text, subtitle text, latitude double precision, longitude double precision,
  starts_at timestamptz, ends_at timestamptz, author_id uuid, author_username text, author_display_name text)
language sql stable security invoker set search_path = ''
as $$
  with viewport as (select extensions.st_makeenvelope(west, south, east, north, 4326)::extensions.geography bounds)
  select e.id, e.kind::text, e.title, e.location_label, e.latitude, e.longitude, e.starts_at, e.ends_at,
    p.id, p.username, p.display_name
  from public.events e join public.profiles p on p.id = e.organizer_id cross join viewport v
  where e.deleted_at is null and extensions.st_intersects(e.location, v.bounds)
    and ((e.kind = 'trip' and 'trips' = any(layers)) or (e.kind <> 'trip' and 'events' = any(layers)));
$$;
revoke all on function public.explore_content(double precision, double precision, double precision, double precision, text[]) from public, anon, authenticated;
grant execute on function public.explore_content(double precision, double precision, double precision, double precision, text[]) to service_role;

create or replace function public.save_post_with_markers(target_post_id uuid, post_body text, marker_tags jsonb, post_community_category public.community_category)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid;
begin
  if jsonb_typeof(marker_tags) is distinct from 'array' or jsonb_array_length(marker_tags) > 5
    or exists (select 1 from jsonb_array_elements(marker_tags) item where item->>'kind' <> 'event' or item->>'id' is null)
    or exists (select 1 from jsonb_array_elements(marker_tags) item group by item->>'id' having count(*) > 1)
  then raise exception using errcode = '22023', message = 'post_marker_tags_invalid'; end if;
  if target_post_id is null then
    insert into public.posts(author_id, body, community_category) values (auth.uid(), post_body, post_community_category) returning id into saved_id;
  else
    update public.posts set body = post_body, community_category = post_community_category, updated_at = now()
      where id = target_post_id and author_id = auth.uid() and deleted_at is null returning id into saved_id;
    if saved_id is null then raise exception using errcode = 'P0002', message = 'post_not_found'; end if;
  end if;
  delete from public.post_marker_tags where post_id = saved_id;
  insert into public.post_marker_tags(post_id, position, event_id)
    select saved_id, (ordinality - 1)::smallint, (item->>'id')::uuid
    from jsonb_array_elements(marker_tags) with ordinality as tags(item, ordinality);
  return saved_id;
end;
$$;
revoke all on function public.save_post_with_markers(uuid, text, jsonb, public.community_category) from public, anon;
grant execute on function public.save_post_with_markers(uuid, text, jsonb, public.community_category) to authenticated, service_role;
