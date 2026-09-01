alter table public.account_access
  add column transition_actor_id uuid references auth.users(id) on delete restrict,
  add column transition_previous_role public.account_role;

-- The earlier saga did not record an actor, so a pending row cannot be safely
-- finalized by identity. Resolve those deployments fail-closed by rolling them
-- back before requiring the new, token-bound actor state.
insert into public.admin_audit_log (admin_id, action, target_table, target_id, before_state, after_state)
select user_id, 'migration_rollback_unattributed_transition', 'account_access', user_id,
  jsonb_build_object('role', role, 'status', status, 'transitionId', transition_id),
  jsonb_build_object('role', role, 'status', transition_previous_status)
from public.account_access
where transition_id is not null;

update public.account_access
set status = transition_previous_status,
    transition_id = null,
    transition_action = null,
    transition_previous_status = null,
    transition_started_at = null
where transition_id is not null;

alter table public.account_access drop constraint account_access_transition_state_check;
alter table public.account_access
  add constraint account_access_transition_state_check check (
    (transition_id is null and transition_action is null and transition_previous_status is null and transition_started_at is null and transition_actor_id is null and transition_previous_role is null)
    or (transition_id is not null and transition_action in ('lock', 'unlock', 'suspend', 'restore', 'promote') and transition_previous_status is not null and transition_started_at is not null and transition_actor_id is not null and transition_previous_role is not null)
  );

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_access
    where user_id = (select auth.uid())
      and role = 'admin'::public.account_role
      and status = 'active'::public.account_status
      and transition_id is null
  );
$$;

create or replace function private.can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_access
    where user_id = (select auth.uid())
      and status = 'active'::public.account_status
      and transition_id is null
  );
$$;

create or replace function private.is_suspended(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_access
    where user_id = target_user_id
      and (status = 'suspended'::public.account_status or transition_id is not null)
  );
$$;

create or replace function public.begin_account_access_transition(target_user_id uuid, requested_action text, actor_id uuid)
returns table(role public.account_role, status public.account_status, updated_at timestamptz, transition_token uuid, previous_status public.account_status)
language plpgsql security definer set search_path = ''
as $$
declare actor public.account_access; target public.account_access; next_status public.account_status; token uuid := extensions.gen_random_uuid();
begin
  perform 1 from public.account_access where role = 'admin'::public.account_role and status = 'active'::public.account_status and transition_id is null order by user_id for update;
  select * into actor from public.account_access where user_id = actor_id for update;
  if actor.user_id is null or actor.role <> 'admin'::public.account_role or actor.status <> 'active'::public.account_status or actor.transition_id is not null then raise exception using errcode = '42501', message = 'admin_forbidden'; end if;
  select * into target from public.account_access where user_id = target_user_id for update;
  if target.user_id is null then raise exception using errcode = 'P0002', message = 'account_not_found'; end if;
  if target.transition_id is not null then raise exception using errcode = 'P0001', message = 'transition_in_progress'; end if;
  if requested_action not in ('lock', 'unlock', 'suspend', 'restore') then raise exception using errcode = '22023', message = 'invalid_action'; end if;
  if requested_action in ('lock', 'suspend') and target_user_id = actor_id then raise exception using errcode = '42501', message = 'self_protected'; end if;
  next_status := case requested_action when 'lock' then 'locked'::public.account_status when 'unlock' then 'active'::public.account_status when 'suspend' then 'suspended'::public.account_status when 'restore' then 'active'::public.account_status end;
  if not ((requested_action = 'lock' and target.status = 'active'::public.account_status) or (requested_action = 'unlock' and target.status = 'locked'::public.account_status) or (requested_action = 'suspend' and target.status in ('active'::public.account_status, 'locked'::public.account_status)) or (requested_action = 'restore' and target.status = 'suspended'::public.account_status)) then raise exception using errcode = 'P0001', message = 'invalid_transition'; end if;
  if target.role = 'admin'::public.account_role and target.status = 'active'::public.account_status and requested_action in ('lock', 'suspend') and (select count(*) from public.account_access where role = 'admin'::public.account_role and status = 'active'::public.account_status and transition_id is null) <= 1 then raise exception using errcode = 'P0001', message = 'last_active_admin'; end if;
  update public.account_access set status = next_status, transition_id = token, transition_action = requested_action, transition_previous_status = target.status, transition_previous_role = target.role, transition_actor_id = actor_id, transition_started_at = now() where user_id = target_user_id returning account_access.role, account_access.status, account_access.updated_at, account_access.transition_id, account_access.transition_previous_status into role, status, updated_at, transition_token, previous_status;
  insert into public.admin_audit_log(admin_id, action, target_table, target_id, before_state, after_state) values (actor_id, 'begin_' || requested_action, 'account_access', target_user_id, jsonb_build_object('role', target.role, 'status', target.status), jsonb_build_object('role', role, 'status', status, 'transitionId', transition_token));
  return next;
end;
$$;

create or replace function public.begin_bootstrap_account_promotion(target_user_id uuid)
returns table(role public.account_role, status public.account_status, updated_at timestamptz, transition_token uuid, previous_status public.account_status)
language plpgsql security definer set search_path = ''
as $$
declare target public.account_access; token uuid := extensions.gen_random_uuid();
begin
  perform 1 from public.account_access where role = 'admin'::public.account_role and status = 'active'::public.account_status and transition_id is null order by user_id for update;
  select * into target from public.account_access where user_id = target_user_id for update;
  if target.user_id is null then raise exception using errcode = 'P0002', message = 'account_not_found'; end if;
  if target.transition_id is not null then raise exception using errcode = 'P0001', message = 'transition_in_progress'; end if;
  update public.account_access set role = 'admin'::public.account_role, status = 'active'::public.account_status, transition_id = token, transition_action = 'promote', transition_previous_status = target.status, transition_previous_role = target.role, transition_actor_id = target_user_id, transition_started_at = now() where user_id = target_user_id returning account_access.role, account_access.status, account_access.updated_at, account_access.transition_id, account_access.transition_previous_status into role, status, updated_at, transition_token, previous_status;
  insert into public.admin_audit_log(admin_id, action, target_table, target_id, before_state, after_state) values (target_user_id, 'begin_bootstrap_promote', 'account_access', target_user_id, jsonb_build_object('role', target.role, 'status', target.status), jsonb_build_object('role', role, 'status', status, 'transitionId', transition_token));
  return next;
end;
$$;

create or replace function public.finalize_account_access_transition(target_user_id uuid, actor_id uuid, transition_token uuid)
returns table(role public.account_role, status public.account_status, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare target public.account_access; completed_action text;
begin
  select * into target from public.account_access where user_id = target_user_id for update;
  if target.user_id is null then raise exception using errcode = 'P0002', message = 'account_not_found'; end if;
  if target.transition_id is null or target.transition_id is distinct from transition_token or target.transition_actor_id is distinct from actor_id then raise exception using errcode = 'P0001', message = 'transition_token_mismatch'; end if;
  completed_action := target.transition_action;
  update public.account_access set transition_id = null, transition_action = null, transition_previous_status = null, transition_previous_role = null, transition_actor_id = null, transition_started_at = null where user_id = target_user_id returning account_access.role, account_access.status, account_access.updated_at into role, status, updated_at;
  insert into public.admin_audit_log(admin_id, action, target_table, target_id, before_state, after_state) values (actor_id, 'finalize_' || completed_action, 'account_access', target_user_id, jsonb_build_object('role', target.role, 'status', target.status, 'transitionId', transition_token), jsonb_build_object('role', role, 'status', status));
  return next;
end;
$$;

create or replace function public.rollback_account_access_transition(target_user_id uuid, actor_id uuid, transition_token uuid)
returns table(role public.account_role, status public.account_status, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare target public.account_access; failed_action text;
begin
  select * into target from public.account_access where user_id = target_user_id for update;
  if target.user_id is null then raise exception using errcode = 'P0002', message = 'account_not_found'; end if;
  if target.transition_id is null or target.transition_id is distinct from transition_token or target.transition_actor_id is distinct from actor_id then raise exception using errcode = 'P0001', message = 'transition_token_mismatch'; end if;
  failed_action := target.transition_action;
  update public.account_access set role = target.transition_previous_role, status = target.transition_previous_status, transition_id = null, transition_action = null, transition_previous_status = null, transition_previous_role = null, transition_actor_id = null, transition_started_at = null where user_id = target_user_id returning account_access.role, account_access.status, account_access.updated_at into role, status, updated_at;
  insert into public.admin_audit_log(admin_id, action, target_table, target_id, before_state, after_state) values (actor_id, 'rollback_' || failed_action, 'account_access', target_user_id, jsonb_build_object('role', target.role, 'status', target.status, 'transitionId', transition_token), jsonb_build_object('role', role, 'status', status));
  return next;
end;
$$;

create or replace function public.recover_stale_account_access_transition(target_user_id uuid, recovery_actor_id uuid, transition_token uuid, stale_after_seconds integer default 900)
returns table(role public.account_role, status public.account_status, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare actor public.account_access; target public.account_access; recovered_action text;
begin
  if stale_after_seconds < 60 or stale_after_seconds > 86400 then raise exception using errcode = '22023', message = 'invalid_stale_window'; end if;
  select * into actor from public.account_access where user_id = recovery_actor_id for update;
  if actor.user_id is null or actor.role <> 'admin'::public.account_role or actor.status <> 'active'::public.account_status or actor.transition_id is not null then raise exception using errcode = '42501', message = 'admin_forbidden'; end if;
  select * into target from public.account_access where user_id = target_user_id for update;
  if target.user_id is null then raise exception using errcode = 'P0002', message = 'account_not_found'; end if;
  if target.transition_id is null or target.transition_id is distinct from transition_token then raise exception using errcode = 'P0001', message = 'transition_token_mismatch'; end if;
  if target.transition_started_at > now() - make_interval(secs => stale_after_seconds) then raise exception using errcode = 'P0001', message = 'transition_not_stale'; end if;
  recovered_action := target.transition_action;
  update public.account_access set role = target.transition_previous_role, status = target.transition_previous_status, transition_id = null, transition_action = null, transition_previous_status = null, transition_previous_role = null, transition_actor_id = null, transition_started_at = null where user_id = target_user_id returning account_access.role, account_access.status, account_access.updated_at into role, status, updated_at;
  insert into public.admin_audit_log(admin_id, action, target_table, target_id, before_state, after_state) values (recovery_actor_id, 'recover_stale_' || recovered_action, 'account_access', target_user_id, jsonb_build_object('role', target.role, 'status', target.status, 'transitionId', transition_token), jsonb_build_object('role', role, 'status', status));
  return next;
end;
$$;

create or replace function public.complete_media_upload(target_media_id uuid, expected_owner_id uuid, message jsonb)
returns bigint language plpgsql security invoker set search_path = ''
as $$
declare message_id bigint;
begin
  if not exists (select 1 from public.account_access where user_id = expected_owner_id and status = 'active'::public.account_status and transition_id is null) then raise exception using errcode = '42501', message = 'account_write_forbidden'; end if;
  update public.media set status = 'processing' where id = target_media_id and owner_id = expected_owner_id and status = 'uploading' and deleted_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'media_upload_not_found'; end if;
  select public.enqueue_job('media_processing', message, 0) into message_id;
  return message_id;
end;
$$;

revoke all on function public.begin_bootstrap_account_promotion(uuid) from public, anon, authenticated;
revoke all on function public.recover_stale_account_access_transition(uuid, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.begin_bootstrap_account_promotion(uuid) to service_role;
grant execute on function public.recover_stale_account_access_transition(uuid, uuid, uuid, integer) to service_role;
