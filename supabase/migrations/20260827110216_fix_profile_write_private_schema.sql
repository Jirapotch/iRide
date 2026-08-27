create or replace function private.prepare_profile_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.username = nullif(lower(btrim(new.username)), '');
  new.display_name = nullif(btrim(new.display_name), '');
  new.bio = nullif(btrim(new.bio), '');
  new.location_name = nullif(btrim(new.location_name), '');

  if new.username is not null and new.username = any (array[
    'account', 'api', 'auth', 'login', 'logout', 'onboarding',
    'profile', 'profiles', 'users', 'feed', 'explore', 'garage',
    'events', 'communities', 'photographers', 'marketplace', 'cart',
    'orders', 'settings', 'admin', 'support', 'help', 'about',
    'terms', 'privacy', 'iride', 'th', 'en'
  ]::text[]) then
    raise exception using errcode = '23514', message = 'username_reserved';
  end if;

  if tg_op = 'UPDATE' and new.username is distinct from old.username then
    if old.username is not null and new.username is null then
      raise exception using errcode = '23514', message = 'username_required';
    end if;

    if old.username is not null
      and old.username_changed_at is not null
      and old.username_changed_at > now() - interval '30 days'
    then
      raise exception using errcode = 'P0001', message = 'username_cooldown';
    end if;

    new.username_changed_at = case
      when new.username is null then null
      else now()
    end;
  end if;

  return new;
end;
$$;

drop function if exists private.profile_username_is_reserved(text);
