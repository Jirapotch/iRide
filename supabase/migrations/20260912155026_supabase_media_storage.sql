-- Existing object keys belong to R2; only subsequent inserts default to Supabase.
alter table public.media add column if not exists storage_provider text not null default 'r2';
alter table public.media alter column storage_provider set default 'supabase';
alter table public.media add column if not exists original_cleaned_at timestamptz;
alter table public.media alter column original_object_key drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.media'::regclass and conname = 'media_storage_provider') then
    alter table public.media add constraint media_storage_provider check (storage_provider in ('r2', 'supabase'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.media'::regclass and conname = 'media_original_cleanup') then
    alter table public.media add constraint media_original_cleanup check (
      (original_object_key is not null and original_cleaned_at is null)
      or (original_object_key is null and original_cleaned_at is not null and status in ('ready', 'failed', 'deleted'))
    );
  end if;
end;
$$;

-- Clients create uploading rows and read their own media. All later state belongs
-- to the service-role completion/processing/cleanup flow, including app admins.
revoke update on table public.media from public, anon, authenticated;
drop policy if exists media_owner_update on public.media;

-- A direct Data API insert must not import another object's path, choose a legacy
-- provider, or claim that server processing/cleanup has already happened.
drop policy if exists media_upload_initial_state on public.media;
create policy media_upload_initial_state on public.media
as restrictive for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and storage_provider = 'supabase'
  and original_object_key = 'users/' || owner_id::text || '/' || purpose::text || '/' || id::text || '/original'
  and original_cleaned_at is null
  and status = 'uploading'
  and width is null and height is null
  and failure_reason is null and deleted_at is null
);

-- Supported bucket configuration only: no changes to Storage-managed objects or policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Preserve existing authorization, auditing and grants while retaining each object's
-- provider in cleanup payloads before its metadata is deleted.
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

    select coalesce(jsonb_agg(jsonb_build_object('objectKey', keys.object_key, 'storageProvider', keys.storage_provider) order by keys.object_key), '[]'::jsonb)
      into object_keys
    from (
      select original_object_key as object_key, storage_provider from public.media where id = any(orphan_media_ids) and original_object_key is not null
      union
      select v.object_key, m.storage_provider from public.media_variants v join public.media m on m.id = v.media_id where v.media_id = any(orphan_media_ids)
    ) as keys;

    delete from public.media where id = any(orphan_media_ids);
  end if;

  if jsonb_array_length(object_keys) > 0 then
    message := jsonb_build_object(
      'version', 1,
      'jobId', extensions.gen_random_uuid()::text,
      'idempotencyKey', 'vehicle-delete:' || target_vehicle_id::text,
      'attempt', 1,
      'objects', object_keys
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


create or replace function public.delete_admin_moderated_resource(
  moderator_id uuid,
  target_resource_id uuid,
  resource_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
<<moderation_delete>>
declare
  moderator public.account_access;
  before_state jsonb;
  after_state jsonb;
  target_table text;
  media_ids uuid[] := array[]::uuid[];
  orphan_media_ids uuid[] := array[]::uuid[];
  object_keys jsonb := '[]'::jsonb;
  cleanup_message jsonb;
begin
  select * into moderator
  from public.account_access
  where user_id = moderator_id
  for update;

  if moderator.user_id is null
    or moderator.role <> 'admin'::public.account_role
    or moderator.status <> 'active'::public.account_status
    or moderator.transition_id is not null then
    raise exception using errcode = '42501', message = 'admin_forbidden';
  end if;

  if resource_kind is null
    or resource_kind not in ('post', 'event', 'photographerSpot', 'vehicle') then
    raise exception using errcode = '22023', message = 'invalid_moderated_resource';
  end if;

  if resource_kind = 'post' then
    select to_jsonb(post) into before_state
    from public.posts as post
    where post.id = target_resource_id and post.deleted_at is null
    for update;
    if before_state is null then raise exception using errcode = 'P0002', message = 'moderated_resource_not_found'; end if;
    insert into private.moderation_audit_suppression (transaction_id, target_table, target_id)
    values (txid_current(), 'posts', target_resource_id)
    on conflict do nothing;
    update public.posts set deleted_at = now() where id = target_resource_id;
    target_table := 'posts';
    after_state := jsonb_set(before_state, '{deleted_at}', to_jsonb(now()), true);
  elsif resource_kind = 'event' then
    select to_jsonb(event) into before_state
    from public.events as event
    where event.id = target_resource_id and event.deleted_at is null
    for update;
    if before_state is null then raise exception using errcode = 'P0002', message = 'moderated_resource_not_found'; end if;
    insert into private.moderation_audit_suppression (transaction_id, target_table, target_id)
    values (txid_current(), 'events', target_resource_id)
    on conflict do nothing;
    update public.events set deleted_at = now() where id = target_resource_id;
    target_table := 'events';
    after_state := jsonb_set(before_state, '{deleted_at}', to_jsonb(now()), true);
  elsif resource_kind = 'photographerSpot' then
    select to_jsonb(spot) into before_state
    from public.photographer_spots as spot
    where spot.id = target_resource_id and spot.deleted_at is null
    for update;
    if before_state is null then raise exception using errcode = 'P0002', message = 'moderated_resource_not_found'; end if;
    insert into private.moderation_audit_suppression (transaction_id, target_table, target_id)
    values (txid_current(), 'photographer_spots', target_resource_id)
    on conflict do nothing;
    update public.photographer_spots set deleted_at = now() where id = target_resource_id;
    target_table := 'photographer_spots';
    after_state := jsonb_set(before_state, '{deleted_at}', to_jsonb(now()), true);
  else
    select to_jsonb(vehicle) into before_state
    from public.vehicles as vehicle
    where vehicle.id = target_resource_id
    for update;
    if before_state is null then raise exception using errcode = 'P0002', message = 'moderated_resource_not_found'; end if;

    select coalesce(array_agg(media_id), array[]::uuid[])
      into media_ids
    from public.vehicle_media
    where vehicle_id = target_resource_id;

    delete from public.vehicles where id = target_resource_id;

    if cardinality(media_ids) > 0 then
      select coalesce(array_agg(candidate_id), array[]::uuid[])
        into orphan_media_ids
      from unnest(media_ids) as candidate(candidate_id)
      where not exists (
        select 1 from public.vehicle_media where media_id = candidate_id
      );

      select coalesce(jsonb_agg(jsonb_build_object('objectKey', keys.object_key, 'storageProvider', keys.storage_provider) order by keys.object_key), '[]'::jsonb)
        into object_keys
      from (
        select original_object_key as object_key, storage_provider from public.media where id = any(orphan_media_ids) and original_object_key is not null
        union
        select v.object_key, m.storage_provider from public.media_variants v join public.media m on m.id = v.media_id where v.media_id = any(orphan_media_ids)
      ) as keys;

      delete from public.media where id = any(orphan_media_ids);
    end if;

    if jsonb_array_length(object_keys) > 0 then
      cleanup_message := jsonb_build_object(
        'version', 1,
        'jobId', extensions.gen_random_uuid()::text,
        'idempotencyKey', 'admin-vehicle-delete:' || target_resource_id::text,
        'attempt', 1,
        'objects', object_keys
      );
      perform public.enqueue_job('media_cleanup', cleanup_message, 0);
    end if;

    target_table := 'vehicles';
    after_state := jsonb_build_object('deleted', true);
  end if;

  insert into public.admin_audit_log (admin_id, action, target_table, target_id, before_state, after_state)
  values (moderator_id, 'moderation_delete', target_table, target_resource_id, before_state, after_state);

  delete from private.moderation_audit_suppression as suppression
  where suppression.transaction_id = txid_current()
    and suppression.target_table = moderation_delete.target_table
    and suppression.target_id = target_resource_id;
end;
$$;

revoke all on function public.delete_admin_moderated_resource(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.delete_admin_moderated_resource(uuid, uuid, text) to service_role;
