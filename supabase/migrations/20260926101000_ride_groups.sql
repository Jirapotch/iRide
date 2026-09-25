create table public.ride_groups (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  creator_id uuid references public.profiles(id) on delete restrict,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ride_groups_system_owner check ((is_system and creator_id is null) or (not is_system and creator_id is not null))
);
create trigger set_ride_groups_updated_at before update on public.ride_groups
  for each row execute function public.set_updated_at();

create table public.ride_group_members (
  group_id uuid not null references public.ride_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index ride_group_members_user_idx on public.ride_group_members(user_id);

alter table public.posts add column group_id uuid references public.ride_groups(id) on delete restrict;
alter table public.events add column group_id uuid references public.ride_groups(id) on delete set null;
create index posts_group_created_idx on public.posts(group_id, created_at desc) where deleted_at is null;
create index events_group_created_idx on public.events(group_id, created_at desc) where deleted_at is null;

insert into public.ride_groups(slug, name, description, is_system)
values ('iride-general', 'iRide ส่วนกลาง', 'พื้นที่พูดคุยของทุกคนใน iRide', true);
update public.posts set group_id = (select id from public.ride_groups where slug = 'iride-general')
where community_category = 'groups';
insert into public.ride_group_members(group_id, user_id)
select distinct p.group_id, p.author_id from public.posts p
where p.group_id is not null on conflict do nothing;

alter table public.posts add constraint posts_group_link_consistent check (
  (community_category = 'groups' and group_id is not null)
  or (community_category <> 'groups' and group_id is null)
);

alter table public.ride_groups enable row level security;
alter table public.ride_group_members enable row level security;
revoke all on public.ride_groups, public.ride_group_members from public, anon, authenticated;
grant select on public.ride_groups, public.ride_group_members to anon;
grant select, insert, update on public.ride_groups to authenticated;
grant select, insert, delete on public.ride_group_members to authenticated;
grant all on public.ride_groups, public.ride_group_members to service_role;

create policy ride_groups_read on public.ride_groups for select to anon, authenticated using (true);
create policy ride_groups_create on public.ride_groups for insert to authenticated
with check (creator_id = (select auth.uid()) and not is_system and private.can_write());
create policy ride_groups_owner_update on public.ride_groups for update to authenticated
using (creator_id = (select auth.uid()) and private.can_write())
with check (creator_id = (select auth.uid()) and not is_system and private.can_write());
create policy ride_group_members_read on public.ride_group_members for select to anon, authenticated using (true);
create policy ride_group_members_join on public.ride_group_members for insert to authenticated
with check (user_id = (select auth.uid()) and private.can_write());
create policy ride_group_members_leave on public.ride_group_members for delete to authenticated
using (user_id = (select auth.uid()) and not exists (
  select 1 from public.ride_groups g where g.id = group_id and g.creator_id = (select auth.uid())
));

create function private.join_new_group_creator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.creator_id is not null then
    insert into public.ride_group_members(group_id, user_id) values (new.id, new.creator_id);
  end if;
  return new;
end;
$$;
revoke all on function private.join_new_group_creator() from public, anon, authenticated;
create trigger join_new_group_creator after insert on public.ride_groups
for each row execute function private.join_new_group_creator();

create policy posts_group_membership on public.posts as restrictive for insert to authenticated
with check (group_id is null or exists (
  select 1 from public.ride_group_members m where m.group_id = posts.group_id and m.user_id = (select auth.uid())
));
create policy events_group_membership on public.events as restrictive for insert to authenticated
with check (group_id is null or exists (
  select 1 from public.ride_group_members m where m.group_id = events.group_id and m.user_id = (select auth.uid())
));

-- Owners may still edit or remove their own content after leaving a group.
-- A new group link always requires current membership, including on updates.
create function private.require_membership_for_new_group_link() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare needs_membership boolean;
begin
  if tg_op = 'INSERT' then
    needs_membership := new.group_id is not null;
  else
    needs_membership := new.group_id is not null and new.group_id is distinct from old.group_id;
  end if;
  if needs_membership and current_user <> 'service_role'
    and not exists (select 1 from public.ride_group_members m
      where m.group_id = new.group_id and m.user_id = (select auth.uid()))
  then
    raise exception using errcode = '42501', message = 'group_membership_required';
  end if;
  return new;
end;
$$;
revoke all on function private.require_membership_for_new_group_link() from public, anon, authenticated;
create trigger posts_new_group_link before insert or update on public.posts
for each row execute function private.require_membership_for_new_group_link();
create trigger events_new_group_link before insert or update on public.events
for each row execute function private.require_membership_for_new_group_link();

create function public.save_post_with_markers(
  target_post_id uuid, post_body text, marker_tags jsonb,
  post_community_category public.community_category, post_group_id uuid
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid; chosen_group uuid;
begin
  if jsonb_typeof(marker_tags) is distinct from 'array' or jsonb_array_length(marker_tags) > 5
    or exists (select 1 from jsonb_array_elements(marker_tags) item where item->>'kind' <> 'event' or item->>'id' is null)
    or exists (select 1 from jsonb_array_elements(marker_tags) item group by item->>'id' having count(*) > 1)
  then raise exception using errcode = '22023', message = 'post_marker_tags_invalid'; end if;
  if post_community_category = 'groups' then
    chosen_group := coalesce(post_group_id, (select id from public.ride_groups where slug = 'iride-general'));
    if chosen_group is null then raise exception using errcode = '22023', message = 'group_required'; end if;
    if chosen_group = (select id from public.ride_groups where slug = 'iride-general') then
      insert into public.ride_group_members(group_id, user_id) values (chosen_group, auth.uid()) on conflict do nothing;
    end if;
  elsif post_group_id is not null then
    raise exception using errcode = '22023', message = 'group_category_required';
  end if;
  if target_post_id is null then
    insert into public.posts(author_id, body, community_category, group_id)
    values (auth.uid(), post_body, post_community_category, chosen_group) returning id into saved_id;
  else
    update public.posts set body = post_body, community_category = post_community_category,
      group_id = chosen_group, updated_at = now()
      where id = target_post_id and author_id = auth.uid() and deleted_at is null returning id into saved_id;
    if saved_id is null then raise exception using errcode = 'P0002', message = 'post_not_found'; end if;
  end if;
  delete from public.post_marker_tags where post_id = saved_id;
  insert into public.post_marker_tags(post_id, position, event_id)
    select saved_id, (ordinality - 1)::smallint, (item->>'id')::uuid
    from jsonb_array_elements(marker_tags) with ordinality as tags(item, ordinality);
  return saved_id;
end;
$$;
revoke all on function public.save_post_with_markers(uuid, text, jsonb, public.community_category, uuid) from public, anon;
grant execute on function public.save_post_with_markers(uuid, text, jsonb, public.community_category, uuid) to authenticated, service_role;

-- Existing clients and database contract tests still call the four-argument API.
create or replace function public.save_post_with_markers(
  target_post_id uuid, post_body text, marker_tags jsonb,
  post_community_category public.community_category
)
returns uuid language sql security invoker set search_path = '' as $$
  select public.save_post_with_markers(
    target_post_id, post_body, marker_tags, post_community_category, null::uuid
  );
$$;
