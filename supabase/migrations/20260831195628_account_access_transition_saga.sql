alter table public.account_access
  add column transition_id uuid,
  add column transition_action text,
  add column transition_previous_status public.account_status,
  add column transition_started_at timestamptz,
  add constraint account_access_transition_state_check check (
    (transition_id is null and transition_action is null and transition_previous_status is null and transition_started_at is null)
    or (transition_id is not null and transition_action in ('lock', 'unlock', 'suspend', 'restore') and transition_previous_status is not null and transition_started_at is not null)
  );

drop function public.transition_account_access(uuid, text, uuid);
drop function public.rollback_account_access_transition(uuid, text, uuid, public.account_status);

create or replace function public.begin_account_access_transition(
  target_user_id uuid,
  requested_action text,
  actor_id uuid
)
returns table(role public.account_role, status public.account_status, updated_at timestamptz, transition_token uuid, previous_status public.account_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.account_access;
  target public.account_access;
  next_status public.account_status;
  token uuid := extensions.gen_random_uuid();
begin
  perform 1 from public.account_access
  where role = 'admin'::public.account_role and status = 'active'::public.account_status
  order by user_id for update;
  select * into actor from public.account_access where user_id = actor_id for update;
  if actor.user_id is null or actor.role <> 'admin'::public.account_role or actor.status <> 'active'::public.account_status then
    raise exception using errcode = '42501', message = 'admin_forbidden';
  end if;
  select * into target from public.account_access where user_id = target_user_id for update;
  if target.user_id is null then raise exception using errcode = 'P0002', message = 'account_not_found'; end if;
  if target.transition_id is not null then raise exception using errcode = 'P0001', message = 'transition_in_progress'; end if;
  if requested_action not in ('lock', 'unlock', 'suspend', 'restore') then raise exception using errcode = '22023', message = 'invalid_action'; end if;
  if requested_action in ('lock', 'suspend') and target_user_id = actor_id then raise exception using errcode = '42501', message = 'self_protected'; end if;

  next_status := case requested_action
    when 'lock' then 'locked'::public.account_status
    when 'unlock' then 'active'::public.account_status
    when 'suspend' then 'suspended'::public.account_status
    when 'restore' then 'active'::public.account_status
  end;
  if not (
    (requested_action = 'lock' and target.status = 'active'::public.account_status)
    or (requested_action = 'unlock' and target.status = 'locked'::public.account_status)
    or (requested_action = 'suspend' and target.status in ('active'::public.account_status, 'locked'::public.account_status))
    or (requested_action = 'restore' and target.status = 'suspended'::public.account_status)
  ) then raise exception using errcode = 'P0001', message = 'invalid_transition'; end if;
  if target.role = 'admin'::public.account_role and target.status = 'active'::public.account_status and requested_action in ('lock', 'suspend') and (
    select count(*) from public.account_access where role = 'admin'::public.account_role and status = 'active'::public.account_status
  ) <= 1 then raise exception using errcode = 'P0001', message = 'last_active_admin'; end if;

  update public.account_access
  set status = next_status,
      transition_id = token,
      transition_action = requested_action,
      transition_previous_status = target.status,
      transition_started_at = now()
  where user_id = target_user_id
  returning account_access.role, account_access.status, account_access.updated_at, account_access.transition_id, account_access.transition_previous_status
    into role, status, updated_at, transition_token, previous_status;
  insert into public.admin_audit_log(admin_id, action, target_table, target_id, before_state, after_state)
  values (actor_id, 'begin_' || requested_action, 'account_access', target_user_id,
    jsonb_build_object('role', target.role, 'status', target.status),
    jsonb_build_object('role', role, 'status', status, 'transitionId', transition_token));
  return next;
end;
$$;

create or replace function public.finalize_account_access_transition(
  target_user_id uuid,
  actor_id uuid,
  transition_token uuid
)
returns table(role public.account_role, status public.account_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare actor public.account_access; target public.account_access; completed_action text;
begin
  select * into actor from public.account_access where user_id = actor_id for update;
  if actor.user_id is null or actor.role <> 'admin'::public.account_role or actor.status <> 'active'::public.account_status then raise exception using errcode = '42501', message = 'admin_forbidden'; end if;
  select * into target from public.account_access where user_id = target_user_id for update;
  if target.user_id is null then raise exception using errcode = 'P0002', message = 'account_not_found'; end if;
  if target.transition_id is null or target.transition_id is distinct from transition_token then raise exception using errcode = 'P0001', message = 'transition_token_mismatch'; end if;
  completed_action := target.transition_action;
  update public.account_access set transition_id = null, transition_action = null, transition_previous_status = null, transition_started_at = null
  where user_id = target_user_id
  returning account_access.role, account_access.status, account_access.updated_at into role, status, updated_at;
  insert into public.admin_audit_log(admin_id, action, target_table, target_id, before_state, after_state)
  values (actor_id, 'finalize_' || completed_action, 'account_access', target_user_id,
    jsonb_build_object('role', target.role, 'status', target.status, 'transitionId', transition_token),
    jsonb_build_object('role', role, 'status', status));
  return next;
end;
$$;

create or replace function public.rollback_account_access_transition(
  target_user_id uuid,
  actor_id uuid,
  transition_token uuid
)
returns table(role public.account_role, status public.account_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare actor public.account_access; target public.account_access; failed_action text;
begin
  select * into actor from public.account_access where user_id = actor_id for update;
  if actor.user_id is null or actor.role <> 'admin'::public.account_role or actor.status <> 'active'::public.account_status then raise exception using errcode = '42501', message = 'admin_forbidden'; end if;
  select * into target from public.account_access where user_id = target_user_id for update;
  if target.user_id is null then raise exception using errcode = 'P0002', message = 'account_not_found'; end if;
  if target.transition_id is null or target.transition_id is distinct from transition_token then raise exception using errcode = 'P0001', message = 'transition_token_mismatch'; end if;
  failed_action := target.transition_action;
  update public.account_access
  set status = target.transition_previous_status,
      transition_id = null,
      transition_action = null,
      transition_previous_status = null,
      transition_started_at = null
  where user_id = target_user_id
  returning account_access.role, account_access.status, account_access.updated_at into role, status, updated_at;
  insert into public.admin_audit_log(admin_id, action, target_table, target_id, before_state, after_state)
  values (actor_id, 'rollback_' || failed_action, 'account_access', target_user_id,
    jsonb_build_object('role', target.role, 'status', target.status, 'transitionId', transition_token),
    jsonb_build_object('role', role, 'status', status));
  return next;
end;
$$;

create or replace function public.complete_media_upload(target_media_id uuid, expected_owner_id uuid, message jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare message_id bigint;
begin
  if not exists (
    select 1 from public.account_access
    where user_id = expected_owner_id and status = 'active'::public.account_status
  ) then raise exception using errcode = '42501', message = 'account_write_forbidden'; end if;
  update public.media set status = 'processing'
  where id = target_media_id and owner_id = expected_owner_id and status = 'uploading' and deleted_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'media_upload_not_found'; end if;
  select public.enqueue_job('media_processing', message, 0) into message_id;
  return message_id;
end;
$$;

revoke all on function public.begin_account_access_transition(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.finalize_account_access_transition(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.rollback_account_access_transition(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_account_access_transition(uuid, text, uuid) to service_role;
grant execute on function public.finalize_account_access_transition(uuid, uuid, uuid) to service_role;
grant execute on function public.rollback_account_access_transition(uuid, uuid, uuid) to service_role;
