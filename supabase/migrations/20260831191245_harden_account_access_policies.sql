grant usage on schema private to anon, authenticated;

create or replace function public.delete_vehicle_permanently(target_vehicle_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  vehicle_owner_id uuid;
  media_ids uuid[] := array[]::uuid[];
  orphan_media_ids uuid[] := array[]::uuid[];
  object_keys jsonb := '[]'::jsonb;
  message jsonb;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not private.is_admin() and not private.can_write() then
    raise exception using errcode = '42501', message = 'account_write_forbidden';
  end if;

  select owner_id into vehicle_owner_id
  from public.vehicles
  where id = target_vehicle_id
  for update;

  if vehicle_owner_id is null then
    raise exception using errcode = 'P0002', message = 'vehicle_not_found';
  end if;
  if not private.is_admin() and vehicle_owner_id <> actor_id then
    raise exception using errcode = '42501', message = 'vehicle_forbidden';
  end if;

  select coalesce(array_agg(media_id), array[]::uuid[])
    into media_ids
  from public.vehicle_media
  where vehicle_id = target_vehicle_id;

  delete from public.vehicles where id = target_vehicle_id;

  if cardinality(media_ids) > 0 then
    select coalesce(array_agg(candidate_id), array[]::uuid[])
      into orphan_media_ids
    from unnest(media_ids) as candidate(candidate_id)
    where not exists (
      select 1 from public.vehicle_media where media_id = candidate_id
    );

    select coalesce(jsonb_agg(keys.object_key order by keys.object_key), '[]'::jsonb)
      into object_keys
    from (
      select original_object_key as object_key from public.media where id = any(orphan_media_ids)
      union
      select object_key from public.media_variants where media_id = any(orphan_media_ids)
    ) as keys;

    delete from public.media where id = any(orphan_media_ids);
  end if;

  if jsonb_array_length(object_keys) > 0 then
    message := jsonb_build_object(
      'version', 1,
      'jobId', extensions.gen_random_uuid()::text,
      'idempotencyKey', 'vehicle-delete:' || target_vehicle_id::text,
      'attempt', 1,
      'objectKeys', object_keys
    );
    perform public.enqueue_job('media_cleanup', message, 0);
  end if;

  return target_vehicle_id;
end;
$$;

comment on function public.delete_vehicle_permanently(uuid) is
  'Active owner or active admin irreversible vehicle and attached-media deletion with durable R2 cleanup.';
revoke all on function public.delete_vehicle_permanently(uuid) from public, anon, service_role;
grant execute on function public.delete_vehicle_permanently(uuid) to authenticated;

drop policy post_marker_tags_public_select on public.post_marker_tags;
drop policy post_marker_tags_visible_select on public.post_marker_tags;
drop policy post_marker_tags_owner_insert on public.post_marker_tags;
drop policy post_marker_tags_owner_update on public.post_marker_tags;

create policy post_marker_tags_public_select on public.post_marker_tags for select to anon
using (
  exists (
    select 1 from public.posts
    where posts.id = post_marker_tags.post_id
      and posts.deleted_at is null
      and not private.is_suspended(posts.author_id)
  )
  and (
    (post_marker_tags.event_id is not null and exists (
      select 1 from public.events
      where events.id = post_marker_tags.event_id
        and events.deleted_at is null
        and not private.is_suspended(events.organizer_id)
    ))
    or (post_marker_tags.photographer_spot_id is not null and exists (
      select 1 from public.photographer_spots
      where photographer_spots.id = post_marker_tags.photographer_spot_id
        and photographer_spots.deleted_at is null
        and not private.is_suspended(photographer_spots.owner_id)
    ))
  )
);

create policy post_marker_tags_visible_select on public.post_marker_tags for select to authenticated
using (
  private.is_admin()
  or (
    exists (
      select 1 from public.posts
      where posts.id = post_marker_tags.post_id
        and not private.is_suspended(posts.author_id)
        and (posts.deleted_at is null or posts.author_id = (select auth.uid()))
    )
    and (
      (post_marker_tags.event_id is not null and exists (
        select 1 from public.events
        where events.id = post_marker_tags.event_id
          and events.deleted_at is null
          and not private.is_suspended(events.organizer_id)
      ))
      or (post_marker_tags.photographer_spot_id is not null and exists (
        select 1 from public.photographer_spots
        where photographer_spots.id = post_marker_tags.photographer_spot_id
          and photographer_spots.deleted_at is null
          and not private.is_suspended(photographer_spots.owner_id)
      ))
    )
  )
);

create policy post_marker_tags_owner_insert on public.post_marker_tags for insert to authenticated
with check (
  private.is_admin()
  or (
    private.can_write()
    and exists (
      select 1 from public.posts
      where posts.id = post_marker_tags.post_id
        and posts.author_id = (select auth.uid())
        and posts.deleted_at is null
    )
    and (
      (post_marker_tags.event_id is not null and exists (
        select 1 from public.events
        where events.id = post_marker_tags.event_id
          and events.deleted_at is null
          and not private.is_suspended(events.organizer_id)
      ))
      or (post_marker_tags.photographer_spot_id is not null and exists (
        select 1 from public.photographer_spots
        where photographer_spots.id = post_marker_tags.photographer_spot_id
          and photographer_spots.deleted_at is null
          and not private.is_suspended(photographer_spots.owner_id)
      ))
    )
  )
);

create policy post_marker_tags_owner_update on public.post_marker_tags for update to authenticated
using (
  private.is_admin()
  or (
    private.can_write()
    and exists (
      select 1 from public.posts
      where posts.id = post_marker_tags.post_id
        and posts.author_id = (select auth.uid())
        and posts.deleted_at is null
    )
    and (
      (post_marker_tags.event_id is not null and exists (
        select 1 from public.events
        where events.id = post_marker_tags.event_id
          and events.deleted_at is null
          and not private.is_suspended(events.organizer_id)
      ))
      or (post_marker_tags.photographer_spot_id is not null and exists (
        select 1 from public.photographer_spots
        where photographer_spots.id = post_marker_tags.photographer_spot_id
          and photographer_spots.deleted_at is null
          and not private.is_suspended(photographer_spots.owner_id)
      ))
    )
  )
)
with check (
  private.is_admin()
  or (
    private.can_write()
    and exists (
      select 1 from public.posts
      where posts.id = post_marker_tags.post_id
        and posts.author_id = (select auth.uid())
        and posts.deleted_at is null
    )
    and (
      (post_marker_tags.event_id is not null and exists (
        select 1 from public.events
        where events.id = post_marker_tags.event_id
          and events.deleted_at is null
          and not private.is_suspended(events.organizer_id)
      ))
      or (post_marker_tags.photographer_spot_id is not null and exists (
        select 1 from public.photographer_spots
        where photographer_spots.id = post_marker_tags.photographer_spot_id
          and photographer_spots.deleted_at is null
          and not private.is_suspended(photographer_spots.owner_id)
      ))
    )
  )
);

drop function public.save_post_with_markers(uuid, text, jsonb, public.community_category);
create function public.save_post_with_markers(
  target_post_id uuid,
  post_body text,
  marker_tags jsonb,
  post_community_category public.community_category
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare saved_id uuid;
begin
  if jsonb_typeof(marker_tags) is distinct from 'array' or jsonb_array_length(marker_tags) > 5
    or exists (
      select 1 from jsonb_array_elements(marker_tags) item
      where item->>'kind' not in ('event', 'photographerSpot')
        or (item->>'id') is null
    )
    or exists (
      select 1 from jsonb_array_elements(marker_tags) item
      group by item->>'kind', item->>'id' having count(*) > 1
    ) then
    raise exception using errcode = '22023', message = 'post_marker_tags_invalid';
  end if;

  if target_post_id is null then
    insert into public.posts(author_id, body, community_category)
    values ((select auth.uid()), post_body, post_community_category)
    returning id into saved_id;
  else
    update public.posts set body = post_body, community_category = post_community_category
    where id = target_post_id and deleted_at is null
    returning id into saved_id;
    if saved_id is null then raise exception using errcode = 'P0002', message = 'post_not_found'; end if;
  end if;

  delete from public.post_marker_tags where post_id = saved_id;
  insert into public.post_marker_tags(post_id, position, event_id, photographer_spot_id)
  select saved_id, (ordinality - 1)::smallint,
    case when item->>'kind' = 'event' then (item->>'id')::uuid end,
    case when item->>'kind' = 'photographerSpot' then (item->>'id')::uuid end
  from jsonb_array_elements(marker_tags) with ordinality as tags(item, ordinality);
  return saved_id;
end;
$$;
revoke all on function public.save_post_with_markers(uuid, text, jsonb, public.community_category) from public, anon;
grant execute on function public.save_post_with_markers(uuid, text, jsonb, public.community_category) to authenticated, service_role;
