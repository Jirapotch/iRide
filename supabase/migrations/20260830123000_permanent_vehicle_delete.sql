select pgmq.create('media_cleanup');

alter table pgmq.q_media_cleanup enable row level security;
alter table pgmq.a_media_cleanup enable row level security;
revoke all on table pgmq.q_media_cleanup, pgmq.a_media_cleanup from public, anon, authenticated, service_role;

create or replace function private.assert_known_queue(queue_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if queue_name is null or queue_name not in ('media_processing', 'media_cleanup') then
    raise exception 'Unknown queue: %', coalesce(queue_name, '<null>')
      using errcode = '22023';
  end if;
end;
$$;

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

  select owner_id into vehicle_owner_id
  from public.vehicles
  where id = target_vehicle_id
  for update;

  if vehicle_owner_id is null then
    raise exception using errcode = 'P0002', message = 'vehicle_not_found';
  end if;
  if vehicle_owner_id <> actor_id then
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
  'Owner-only irreversible vehicle and attached-media deletion with durable R2 cleanup.';

revoke all on function public.delete_vehicle_permanently(uuid) from public, anon, service_role;
grant execute on function public.delete_vehicle_permanently(uuid) to authenticated;
