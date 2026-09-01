create or replace function public.transition_account_access(
  target_user_id uuid,
  requested_action text,
  actor_id uuid
)
returns table(role public.account_role, status public.account_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.account_access;
  target public.account_access;
  next_status public.account_status;
begin
  -- Lock every active administrator before counting, serializing competing
  -- requests that could otherwise both remove the final administrator. The
  -- stable user-id order also prevents two administrators deadlocking each
  -- other while attempting concurrent transitions.
  perform 1
  from public.account_access
  where role = 'admin'::public.account_role
    and status = 'active'::public.account_status
  order by user_id
  for update;

  select * into actor
  from public.account_access
  where user_id = actor_id
  for update;
  if actor.user_id is null or actor.role <> 'admin'::public.account_role or actor.status <> 'active'::public.account_status then
    raise exception using errcode = '42501', message = 'admin_forbidden';
  end if;

  select * into target
  from public.account_access
  where user_id = target_user_id
  for update;
  if target.user_id is null then
    raise exception using errcode = 'P0002', message = 'account_not_found';
  end if;
  if requested_action not in ('lock', 'unlock', 'suspend', 'restore') then
    raise exception using errcode = '22023', message = 'invalid_action';
  end if;
  if requested_action in ('lock', 'suspend') and target_user_id = actor_id then
    raise exception using errcode = '42501', message = 'self_protected';
  end if;

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
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;
  if target.role = 'admin'::public.account_role and target.status = 'active'::public.account_status and requested_action in ('lock', 'suspend') and (
    select count(*) from public.account_access where role = 'admin'::public.account_role and status = 'active'::public.account_status
  ) <= 1 then
    raise exception using errcode = 'P0001', message = 'last_active_admin';
  end if;

  update public.account_access
  set status = next_status
  where user_id = target_user_id
  returning account_access.role, account_access.status, account_access.updated_at
    into role, status, updated_at;

  insert into public.admin_audit_log(admin_id, action, target_table, target_id, before_state, after_state)
  values (
    actor_id,
    requested_action,
    'account_access',
    target_user_id,
    jsonb_build_object('role', target.role, 'status', target.status),
    jsonb_build_object('role', role, 'status', status)
  );
  return next;
end;
$$;

create or replace function public.rollback_account_access_transition(
  target_user_id uuid,
  original_action text,
  actor_id uuid,
  restore_status public.account_status
)
returns table(role public.account_role, status public.account_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.account_access;
  target public.account_access;
  expected_status public.account_status;
begin
  select * into actor from public.account_access where user_id = actor_id for update;
  if actor.user_id is null or actor.role <> 'admin'::public.account_role or actor.status <> 'active'::public.account_status then
    raise exception using errcode = '42501', message = 'admin_forbidden';
  end if;
  select * into target from public.account_access where user_id = target_user_id for update;
  if target.user_id is null then raise exception using errcode = 'P0002', message = 'account_not_found'; end if;
  expected_status := case original_action
    when 'suspend' then 'suspended'::public.account_status
    when 'restore' then 'active'::public.account_status
    else null
  end;
  if expected_status is null or target.status <> expected_status then
    raise exception using errcode = 'P0001', message = 'transition_conflict';
  end if;

  update public.account_access
  set status = restore_status
  where user_id = target_user_id
  returning account_access.role, account_access.status, account_access.updated_at
    into role, status, updated_at;
  insert into public.admin_audit_log(admin_id, action, target_table, target_id, before_state, after_state)
  values (
    actor_id,
    'rollback_' || original_action,
    'account_access',
    target_user_id,
    jsonb_build_object('role', target.role, 'status', target.status),
    jsonb_build_object('role', role, 'status', status)
  );
  return next;
end;
$$;

revoke all on function public.transition_account_access(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.rollback_account_access_transition(uuid, text, uuid, public.account_status) from public, anon, authenticated;
grant execute on function public.transition_account_access(uuid, text, uuid) to service_role;
grant execute on function public.rollback_account_access_transition(uuid, text, uuid, public.account_status) to service_role;
