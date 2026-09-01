create or replace function private.audit_admin_other_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  resource_owner_id uuid;
  old_record jsonb := to_jsonb(old);
begin
  if old.deleted_at is not null or new.deleted_at is null or actor_id is null then
    return new;
  end if;

  if exists (
    select 1
    from private.moderation_audit_suppression as suppression
    where suppression.transaction_id = txid_current()
      and suppression.target_table = tg_table_name::text
      and suppression.target_id = new.id
  ) then
    return new;
  end if;

  resource_owner_id := case tg_table_name
    when 'posts' then (old_record ->> 'author_id')::uuid
    when 'events' then (old_record ->> 'organizer_id')::uuid
    when 'photographer_spots' then (old_record ->> 'owner_id')::uuid
  end;

  if resource_owner_id is null or resource_owner_id = actor_id then
    return new;
  end if;

  if exists (
    select 1
    from public.account_access as access
    where access.user_id = actor_id
      and access.role = 'admin'::public.account_role
      and access.status = 'active'::public.account_status
      and access.transition_id is null
  ) then
    insert into public.admin_audit_log (admin_id, action, target_table, target_id, before_state, after_state)
    values (actor_id, 'admin_delete', tg_table_name, new.id, old_record, to_jsonb(new));
  end if;
  return new;
end;
$$;

revoke all on function private.audit_admin_other_soft_delete() from public, anon, authenticated, service_role;
