create table private.moderation_audit_suppression (
  transaction_id bigint not null,
  target_table text not null,
  target_id uuid not null,
  primary key (transaction_id, target_table, target_id)
);

alter table private.moderation_audit_suppression enable row level security;
revoke all on table private.moderation_audit_suppression from public, anon, authenticated, service_role;

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
      cleanup_message := jsonb_build_object(
        'version', 1,
        'jobId', extensions.gen_random_uuid()::text,
        'idempotencyKey', 'admin-vehicle-delete:' || target_resource_id::text,
        'attempt', 1,
        'objectKeys', object_keys
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
    and suppression.target_table = target_table
    and suppression.target_id = target_resource_id;
end;
$$;

revoke all on function public.delete_admin_moderated_resource(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.delete_admin_moderated_resource(uuid, uuid, text) to service_role;
