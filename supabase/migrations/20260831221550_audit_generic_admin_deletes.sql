create or replace function private.audit_admin_other_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  resource_owner_id uuid;
begin
  if old.deleted_at is not null or new.deleted_at is null or actor_id is null then
    return new;
  end if;

  resource_owner_id := case tg_table_name
    when 'posts' then old.author_id
    when 'events' then old.organizer_id
    when 'photographer_spots' then old.owner_id
  end;

  if resource_owner_id is null or resource_owner_id = actor_id then
    return new;
  end if;

  if exists (
    select 1
    from public.account_access
    where user_id = actor_id
      and role = 'admin'::public.account_role
      and status = 'active'::public.account_status
      and transition_id is null
  ) then
    insert into public.admin_audit_log (admin_id, action, target_table, target_id, before_state, after_state)
    values (actor_id, 'admin_delete', tg_table_name, new.id, to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

revoke all on function private.audit_admin_other_soft_delete() from public, anon, authenticated, service_role;

drop trigger if exists audit_admin_other_post_delete on public.posts;
create trigger audit_admin_other_post_delete
after update of deleted_at on public.posts
for each row execute function private.audit_admin_other_soft_delete();

drop trigger if exists audit_admin_other_event_delete on public.events;
create trigger audit_admin_other_event_delete
after update of deleted_at on public.events
for each row execute function private.audit_admin_other_soft_delete();

drop trigger if exists audit_admin_other_photographer_spot_delete on public.photographer_spots;
create trigger audit_admin_other_photographer_spot_delete
after update of deleted_at on public.photographer_spots
for each row execute function private.audit_admin_other_soft_delete();

create or replace function public.delete_vehicle_permanently(target_vehicle_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_is_admin boolean := false;
  actor_can_write boolean := false;
  vehicle_owner_id uuid;
  before_state jsonb;
  media_ids uuid[] := array[]::uuid[];
  orphan_media_ids uuid[] := array[]::uuid[];
  object_keys jsonb := '[]'::jsonb;
  message jsonb;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select
    exists (
      select 1 from public.account_access
      where user_id = actor_id
        and role = 'admin'::public.account_role
        and status = 'active'::public.account_status
        and transition_id is null
    ),
    exists (
      select 1 from public.account_access
      where user_id = actor_id
        and status = 'active'::public.account_status
        and transition_id is null
    )
  into actor_is_admin, actor_can_write;

  if not actor_is_admin and not actor_can_write then
    raise exception using errcode = '42501', message = 'account_write_forbidden';
  end if;

  select owner_id, to_jsonb(vehicle)
    into vehicle_owner_id, before_state
  from public.vehicles as vehicle
  where id = target_vehicle_id
  for update;

  if vehicle_owner_id is null then
    raise exception using errcode = 'P0002', message = 'vehicle_not_found';
  end if;
  if not actor_is_admin and vehicle_owner_id <> actor_id then
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

  if actor_is_admin and vehicle_owner_id <> actor_id then
    insert into public.admin_audit_log (admin_id, action, target_table, target_id, before_state, after_state)
    values (actor_id, 'admin_delete', 'vehicles', target_vehicle_id, before_state, jsonb_build_object('deleted', true));
  end if;

  return target_vehicle_id;
end;
$$;

revoke all on function public.delete_vehicle_permanently(uuid) from public, anon, service_role;
grant execute on function public.delete_vehicle_permanently(uuid) to authenticated;
