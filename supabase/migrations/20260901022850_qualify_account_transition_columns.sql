-- RETURNS TABLE exposes `role` and `status` as PL/pgSQL variables. Qualify
-- account_access columns in aggregate/locking queries so PostgreSQL does not
-- reject the transition RPCs with SQLSTATE 42702.
create or replace function public.begin_account_access_transition(target_user_id uuid, requested_action text, actor_id uuid)
returns table(role public.account_role, status public.account_status, updated_at timestamptz, transition_token uuid, previous_status public.account_status)
language plpgsql security definer set search_path = ''
as $$
declare actor public.account_access; target public.account_access; next_status public.account_status; token uuid := extensions.gen_random_uuid();
begin
  perform 1 from public.account_access as active_admin where active_admin.role = 'admin'::public.account_role and active_admin.status = 'active'::public.account_status and active_admin.transition_id is null order by active_admin.user_id for update;
  select * into actor from public.account_access where user_id = actor_id for update;
  if actor.user_id is null or actor.role <> 'admin'::public.account_role or actor.status <> 'active'::public.account_status or actor.transition_id is not null then raise exception using errcode = '42501', message = 'admin_forbidden'; end if;
  select * into target from public.account_access where user_id = target_user_id for update;
  if target.user_id is null then raise exception using errcode = 'P0002', message = 'account_not_found'; end if;
  if target.transition_id is not null then raise exception using errcode = 'P0001', message = 'transition_in_progress'; end if;
  if requested_action not in ('lock', 'unlock', 'suspend', 'restore') then raise exception using errcode = '22023', message = 'invalid_action'; end if;
  if requested_action in ('lock', 'suspend') and target_user_id = actor_id then raise exception using errcode = '42501', message = 'self_protected'; end if;
  next_status := case requested_action when 'lock' then 'locked'::public.account_status when 'unlock' then 'active'::public.account_status when 'suspend' then 'suspended'::public.account_status when 'restore' then 'active'::public.account_status end;
  if not ((requested_action = 'lock' and target.status = 'active'::public.account_status) or (requested_action = 'unlock' and target.status = 'locked'::public.account_status) or (requested_action = 'suspend' and target.status in ('active'::public.account_status, 'locked'::public.account_status)) or (requested_action = 'restore' and target.status = 'suspended'::public.account_status)) then raise exception using errcode = 'P0001', message = 'invalid_transition'; end if;
  if target.role = 'admin'::public.account_role and target.status = 'active'::public.account_status and requested_action in ('lock', 'suspend') and (select count(*) from public.account_access as active_admin where active_admin.role = 'admin'::public.account_role and active_admin.status = 'active'::public.account_status and active_admin.transition_id is null) <= 1 then raise exception using errcode = 'P0001', message = 'last_active_admin'; end if;
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
  perform 1 from public.account_access as active_admin where active_admin.role = 'admin'::public.account_role and active_admin.status = 'active'::public.account_status and active_admin.transition_id is null order by active_admin.user_id for update;
  select * into target from public.account_access where user_id = target_user_id for update;
  if target.user_id is null then raise exception using errcode = 'P0002', message = 'account_not_found'; end if;
  if target.transition_id is not null then raise exception using errcode = 'P0001', message = 'transition_in_progress'; end if;
  update public.account_access set role = 'admin'::public.account_role, status = 'active'::public.account_status, transition_id = token, transition_action = 'promote', transition_previous_status = target.status, transition_previous_role = target.role, transition_actor_id = target_user_id, transition_started_at = now() where user_id = target_user_id returning account_access.role, account_access.status, account_access.updated_at, account_access.transition_id, account_access.transition_previous_status into role, status, updated_at, transition_token, previous_status;
  insert into public.admin_audit_log(admin_id, action, target_table, target_id, before_state, after_state) values (target_user_id, 'begin_bootstrap_promote', 'account_access', target_user_id, jsonb_build_object('role', target.role, 'status', target.status), jsonb_build_object('role', role, 'status', status, 'transitionId', transition_token));
  return next;
end;
$$;

revoke all on function public.begin_account_access_transition(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.begin_bootstrap_account_promotion(uuid) from public, anon, authenticated;
grant execute on function public.begin_account_access_transition(uuid, text, uuid) to service_role;
grant execute on function public.begin_bootstrap_account_promotion(uuid) to service_role;
