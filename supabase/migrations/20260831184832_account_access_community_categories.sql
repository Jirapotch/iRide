create type public.community_category as enum (
  'car',
  'motorcycle',
  'bicycle',
  'photographers',
  'groups'
);
create type public.account_role as enum ('user', 'admin');
create type public.account_status as enum ('locked', 'active', 'suspended');

alter table public.posts
  add column community_category public.community_category not null default 'groups';
alter table public.posts
  alter column community_category drop default;

create index posts_community_category_created_at_idx
  on public.posts (community_category, created_at desc)
  where deleted_at is null;

create table public.account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.account_role not null default 'user',
  status public.account_status not null default 'locked',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_table text not null,
  target_id uuid,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_log_action_not_blank check (char_length(btrim(action)) > 0),
  constraint admin_audit_log_target_table_not_blank check (char_length(btrim(target_table)) > 0)
);

create index admin_audit_log_admin_created_at_idx
  on public.admin_audit_log (admin_id, created_at desc);

create trigger set_account_access_updated_at
before update on public.account_access
for each row execute function public.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;

  insert into public.account_access (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.account_access (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_access
    where user_id = (select auth.uid())
      and role = 'admin'::public.account_role
      and status = 'active'::public.account_status
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
    select 1
    from public.account_access
    where user_id = (select auth.uid())
      and status = 'active'::public.account_status
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
    select 1
    from public.account_access
    where user_id = target_user_id
      and status = 'suspended'::public.account_status
  );
$$;

create or replace function private.enforce_media_status_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'service_role' or private.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception using errcode = '42501', message = 'media_status_managed';
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function private.is_admin() from public, anon, authenticated, service_role;
revoke all on function private.can_write() from public, anon, authenticated, service_role;
revoke all on function private.is_suspended(uuid) from public, anon, authenticated, service_role;
revoke all on function private.enforce_media_status_change() from public, anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.can_write() to authenticated, service_role;
grant execute on function private.is_suspended(uuid) to anon, authenticated, service_role;

alter table public.account_access enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on table public.account_access, public.admin_audit_log from public, anon, authenticated;
grant all on table public.account_access, public.admin_audit_log to service_role;
grant update on table public.media to authenticated;

create trigger enforce_media_status_change
before update on public.media
for each row execute function private.enforce_media_status_change();

drop policy profiles_select_visible_or_owner on public.profiles;
drop policy profiles_update_owner on public.profiles;
create policy profiles_select_visible_or_owner
on public.profiles for select to anon, authenticated
using (
  (not private.is_suspended(id) and username is not null and display_name is not null and visibility in ('public', 'followers'))
  or (not private.is_suspended(id) and (select auth.uid()) = id)
  or private.is_admin()
);
create policy profiles_update_owner
on public.profiles for update to authenticated
using ((not private.is_suspended(id) and (select auth.uid()) = id) or private.is_admin())
with check ((not private.is_suspended(id) and (select auth.uid()) = id) or private.is_admin());

drop policy posts_public_read on public.posts;
drop policy posts_authenticated_read on public.posts;
drop policy posts_owner_insert on public.posts;
drop policy posts_owner_update on public.posts;
create policy posts_public_read on public.posts for select to anon
using (deleted_at is null and not private.is_suspended(author_id));
create policy posts_authenticated_read on public.posts for select to authenticated
using (
  private.is_admin()
  or (not private.is_suspended(author_id) and (deleted_at is null or (select auth.uid()) = author_id))
);
create policy posts_owner_insert on public.posts for insert to authenticated
with check (
  private.is_admin()
  or (
    private.can_write() and (select auth.uid()) = author_id
    and exists (select 1 from public.profiles where id = author_id and username is not null and display_name is not null)
  )
);
create policy posts_owner_update on public.posts for update to authenticated
using (private.is_admin() or (private.can_write() and (select auth.uid()) = author_id))
with check (
  private.is_admin()
  or (
    private.can_write() and (select auth.uid()) = author_id
    and exists (select 1 from public.profiles where id = author_id and username is not null and display_name is not null)
  )
);

drop policy events_public_read on public.events;
drop policy events_authenticated_read on public.events;
drop policy events_owner_insert on public.events;
drop policy events_owner_update on public.events;
create policy events_public_read on public.events for select to anon
using (deleted_at is null and not private.is_suspended(organizer_id));
create policy events_authenticated_read on public.events for select to authenticated
using (
  private.is_admin()
  or (not private.is_suspended(organizer_id) and (deleted_at is null or (select auth.uid()) = organizer_id))
);
create policy events_owner_insert on public.events for insert to authenticated
with check (
  private.is_admin()
  or (
    private.can_write() and (select auth.uid()) = organizer_id
    and exists (select 1 from public.profiles where id = organizer_id and username is not null and display_name is not null)
  )
);
create policy events_owner_update on public.events for update to authenticated
using (private.is_admin() or (private.can_write() and (select auth.uid()) = organizer_id))
with check (
  private.is_admin()
  or (
    private.can_write() and (select auth.uid()) = organizer_id
    and exists (select 1 from public.profiles where id = organizer_id and username is not null and display_name is not null)
  )
);

drop policy photographer_spots_public_read on public.photographer_spots;
drop policy photographer_spots_authenticated_read on public.photographer_spots;
drop policy photographer_spots_owner_insert on public.photographer_spots;
drop policy photographer_spots_owner_update on public.photographer_spots;
create policy photographer_spots_public_read on public.photographer_spots for select to anon
using (deleted_at is null and not private.is_suspended(owner_id));
create policy photographer_spots_authenticated_read on public.photographer_spots for select to authenticated
using (
  private.is_admin()
  or (not private.is_suspended(owner_id) and (deleted_at is null or (select auth.uid()) = owner_id))
);
create policy photographer_spots_owner_insert on public.photographer_spots for insert to authenticated
with check (
  private.is_admin()
  or (
    private.can_write() and (select auth.uid()) = owner_id
    and exists (select 1 from public.profiles where id = owner_id and username is not null and display_name is not null)
  )
);
create policy photographer_spots_owner_update on public.photographer_spots for update to authenticated
using (private.is_admin() or (private.can_write() and (select auth.uid()) = owner_id))
with check (
  private.is_admin()
  or (
    private.can_write() and (select auth.uid()) = owner_id
    and exists (select 1 from public.profiles where id = owner_id and username is not null and display_name is not null)
  )
);

drop policy media_owner_select on public.media;
drop policy media_owner_insert on public.media;
drop policy media_owner_update on public.media;
drop policy media_owner_delete on public.media;
create policy media_owner_select on public.media for select to authenticated
using (private.is_admin() or (not private.is_suspended(owner_id) and (select auth.uid()) = owner_id));
create policy media_owner_insert on public.media for insert to authenticated
with check (private.is_admin() or (private.can_write() and (select auth.uid()) = owner_id and status = 'uploading'));
create policy media_owner_update on public.media for update to authenticated
using (private.is_admin() or (private.can_write() and (select auth.uid()) = owner_id))
with check (private.is_admin() or (private.can_write() and (select auth.uid()) = owner_id));
create policy media_owner_delete on public.media for delete to authenticated
using (private.is_admin() or (private.can_write() and (select auth.uid()) = owner_id));

drop policy media_variants_owner_select on public.media_variants;
create policy media_variants_owner_select on public.media_variants for select to authenticated
using (
  private.is_admin()
  or exists (
    select 1 from public.media
    where media.id = media_variants.media_id
      and media.owner_id = (select auth.uid())
      and not private.is_suspended(media.owner_id)
  )
);

drop policy vehicles_public_select on public.vehicles;
drop policy vehicles_visible_select on public.vehicles;
drop policy vehicles_owner_insert on public.vehicles;
drop policy vehicles_owner_update on public.vehicles;
create policy vehicles_public_select on public.vehicles for select to anon
using (visibility = 'public' and archived_at is null and not private.is_suspended(owner_id));
create policy vehicles_visible_select on public.vehicles for select to authenticated
using (
  private.is_admin()
  or (not private.is_suspended(owner_id) and ((visibility = 'public' and archived_at is null) or owner_id = (select auth.uid())))
);
create policy vehicles_owner_insert on public.vehicles for insert to authenticated
with check (
  private.is_admin()
  or (
    private.can_write() and owner_id = (select auth.uid())
    and exists (select 1 from public.profiles where profiles.id = vehicles.owner_id and profiles.username is not null and profiles.display_name is not null)
  )
);
create policy vehicles_owner_update on public.vehicles for update to authenticated
using (private.is_admin() or (private.can_write() and owner_id = (select auth.uid())))
with check (
  private.is_admin()
  or (
    private.can_write() and owner_id = (select auth.uid())
    and exists (select 1 from public.profiles where profiles.id = vehicles.owner_id and profiles.username is not null and profiles.display_name is not null)
  )
);

drop policy vehicle_media_public_select on public.vehicle_media;
drop policy vehicle_media_visible_select on public.vehicle_media;
drop policy vehicle_media_owner_insert on public.vehicle_media;
drop policy vehicle_media_owner_update on public.vehicle_media;
drop policy vehicle_media_owner_delete on public.vehicle_media;
create policy vehicle_media_public_select on public.vehicle_media for select to anon
using (exists (select 1 from public.vehicles where vehicles.id = vehicle_media.vehicle_id and vehicles.visibility = 'public' and vehicles.archived_at is null and not private.is_suspended(vehicles.owner_id)));
create policy vehicle_media_visible_select on public.vehicle_media for select to authenticated
using (
  private.is_admin()
  or exists (
    select 1 from public.vehicles
    where vehicles.id = vehicle_media.vehicle_id
      and not private.is_suspended(vehicles.owner_id)
      and ((vehicles.visibility = 'public' and vehicles.archived_at is null) or vehicles.owner_id = (select auth.uid()))
  )
);
create policy vehicle_media_owner_insert on public.vehicle_media for insert to authenticated
with check (
  private.is_admin()
  or (
    private.can_write()
    and exists (select 1 from public.vehicles where vehicles.id = vehicle_media.vehicle_id and vehicles.owner_id = (select auth.uid()))
    and exists (select 1 from public.media where media.id = vehicle_media.media_id and media.owner_id = (select auth.uid()) and media.status = 'ready')
  )
);
create policy vehicle_media_owner_update on public.vehicle_media for update to authenticated
using (
  private.is_admin()
  or (private.can_write() and exists (select 1 from public.vehicles where vehicles.id = vehicle_media.vehicle_id and vehicles.owner_id = (select auth.uid())))
)
with check (
  private.is_admin()
  or (
    private.can_write()
    and exists (select 1 from public.vehicles where vehicles.id = vehicle_media.vehicle_id and vehicles.owner_id = (select auth.uid()))
    and exists (select 1 from public.media where media.id = vehicle_media.media_id and media.owner_id = (select auth.uid()) and media.status = 'ready' and media.purpose = 'vehicle' and media.deleted_at is null)
  )
);
create policy vehicle_media_owner_delete on public.vehicle_media for delete to authenticated
using (private.is_admin() or (private.can_write() and exists (select 1 from public.vehicles where vehicles.id = vehicle_media.vehicle_id and vehicles.owner_id = (select auth.uid()))));

drop policy comments_public_select on public.comments;
drop policy comments_visible_select on public.comments;
drop policy comments_owner_insert on public.comments;
drop policy comments_owner_update on public.comments;
create policy comments_public_select on public.comments for select to anon
using (exists (select 1 from public.posts where posts.id = comments.post_id and posts.deleted_at is null and not private.is_suspended(posts.author_id)) and not private.is_suspended(author_id));
create policy comments_visible_select on public.comments for select to authenticated
using (
  private.is_admin()
  or (
    not private.is_suspended(author_id)
    and exists (select 1 from public.posts where posts.id = comments.post_id and not private.is_suspended(posts.author_id) and (posts.deleted_at is null or posts.author_id = (select auth.uid())))
  )
);
create policy comments_owner_insert on public.comments for insert to authenticated
with check (
  private.is_admin()
  or (
    private.can_write() and author_id = (select auth.uid())
    and exists (select 1 from public.posts where posts.id = comments.post_id and posts.deleted_at is null and not private.is_suspended(posts.author_id))
  )
);
create policy comments_owner_update on public.comments for update to authenticated
using (private.is_admin() or (private.can_write() and author_id = (select auth.uid())))
with check (private.is_admin() or (private.can_write() and author_id = (select auth.uid())));

drop policy post_marker_tags_public_select on public.post_marker_tags;
drop policy post_marker_tags_visible_select on public.post_marker_tags;
drop policy post_marker_tags_owner_insert on public.post_marker_tags;
drop policy post_marker_tags_owner_update on public.post_marker_tags;
drop policy post_marker_tags_owner_delete on public.post_marker_tags;
create policy post_marker_tags_public_select on public.post_marker_tags for select to anon
using (exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and posts.deleted_at is null and not private.is_suspended(posts.author_id)));
create policy post_marker_tags_visible_select on public.post_marker_tags for select to authenticated
using (
  private.is_admin()
  or exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and not private.is_suspended(posts.author_id) and (posts.deleted_at is null or posts.author_id = (select auth.uid())))
);
create policy post_marker_tags_owner_insert on public.post_marker_tags for insert to authenticated
with check (
  private.is_admin()
  or (
    private.can_write()
    and exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and posts.author_id = (select auth.uid()) and posts.deleted_at is null)
    and (
      (post_marker_tags.event_id is not null and exists (select 1 from public.events where events.id = post_marker_tags.event_id and events.deleted_at is null))
      or (post_marker_tags.photographer_spot_id is not null and exists (select 1 from public.photographer_spots where photographer_spots.id = post_marker_tags.photographer_spot_id and photographer_spots.deleted_at is null))
    )
  )
);
create policy post_marker_tags_owner_update on public.post_marker_tags for update to authenticated
using (private.is_admin() or (private.can_write() and exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and posts.author_id = (select auth.uid()))))
with check (private.is_admin() or (private.can_write() and exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and posts.author_id = (select auth.uid()))));
create policy post_marker_tags_owner_delete on public.post_marker_tags for delete to authenticated
using (private.is_admin() or (private.can_write() and exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and posts.author_id = (select auth.uid()))));

drop policy market_products_public_select on public.market_products;
drop policy market_products_visible_select on public.market_products;
drop policy market_products_owner_insert on public.market_products;
drop policy market_products_owner_update on public.market_products;
create policy market_products_public_select on public.market_products for select to anon
using (deleted_at is null and not private.is_suspended(owner_id));
create policy market_products_visible_select on public.market_products for select to authenticated
using (
  private.is_admin()
  or (not private.is_suspended(owner_id) and (deleted_at is null or owner_id = (select auth.uid())))
);
create policy market_products_owner_insert on public.market_products for insert to authenticated
with check (
  private.is_admin()
  or (
    private.can_write() and owner_id = (select auth.uid())
    and (cover_media_id is null or exists (
      select 1 from public.media where media.id = market_products.cover_media_id
        and media.owner_id = (select auth.uid()) and media.purpose = 'market'
        and media.status = 'ready' and media.deleted_at is null
    ))
  )
);
create policy market_products_owner_update on public.market_products for update to authenticated
using (private.is_admin() or (private.can_write() and owner_id = (select auth.uid())))
with check (
  private.is_admin()
  or (
    private.can_write() and owner_id = (select auth.uid())
    and (cover_media_id is null or exists (
      select 1 from public.media where media.id = market_products.cover_media_id
        and media.owner_id = (select auth.uid()) and media.purpose = 'market'
        and media.status = 'ready' and media.deleted_at is null
    ))
  )
);

drop function public.save_post_with_markers(uuid, text, jsonb);
create function public.save_post_with_markers(
  target_post_id uuid,
  post_body text,
  marker_tags jsonb,
  post_community_category public.community_category default 'groups'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare saved_id uuid;
begin
  if jsonb_typeof(marker_tags) is distinct from 'array' or jsonb_array_length(marker_tags) > 5
    or exists (
      select 1 from jsonb_array_elements(marker_tags) item
      where item->>'kind' not in ('event', 'photographerSpot')
        or (item->>'id') is null
    )
    or exists (
      select 1 from jsonb_array_elements(marker_tags) item
      group by item->>'kind', item->>'id' having count(*) > 1
    ) then
    raise exception using errcode = '22023', message = 'post_marker_tags_invalid';
  end if;

  if target_post_id is null then
    insert into public.posts(author_id, body, community_category)
    values ((select auth.uid()), post_body, post_community_category)
    returning id into saved_id;
  else
    update public.posts set body = post_body, community_category = post_community_category
    where id = target_post_id and deleted_at is null
    returning id into saved_id;
    if saved_id is null then raise exception using errcode = 'P0002', message = 'post_not_found'; end if;
  end if;

  delete from public.post_marker_tags where post_id = saved_id;
  insert into public.post_marker_tags(post_id, position, event_id, photographer_spot_id)
  select saved_id, (ordinality - 1)::smallint,
    case when item->>'kind' = 'event' then (item->>'id')::uuid end,
    case when item->>'kind' = 'photographerSpot' then (item->>'id')::uuid end
  from jsonb_array_elements(marker_tags) with ordinality as tags(item, ordinality);
  return saved_id;
end;
$$;
revoke all on function public.save_post_with_markers(uuid, text, jsonb, public.community_category) from public, anon;
grant execute on function public.save_post_with_markers(uuid, text, jsonb, public.community_category) to authenticated, service_role;
