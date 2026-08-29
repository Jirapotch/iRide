create type public.media_purpose as enum ('avatar', 'cover', 'vehicle', 'market');
create type public.media_status as enum ('uploading', 'processing', 'ready', 'failed', 'deleted');
create type public.media_variant_kind as enum ('thumbnail', 'preview');
create type public.vehicle_visibility as enum ('public', 'private');

create table public.media (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  purpose public.media_purpose not null,
  status public.media_status not null default 'uploading',
  original_object_key text not null unique,
  filename text not null,
  mime_type text not null,
  bytes bigint not null,
  width integer,
  height integer,
  failure_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_filename_length check (char_length(btrim(filename)) between 1 and 255),
  constraint media_mime_type check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint media_bytes_range check (bytes between 1 and 10485760),
  constraint media_dimensions check ((width is null and height is null) or (width > 0 and height > 0)),
  constraint media_failure_state check ((status = 'failed') = (failure_reason is not null))
);

create table public.media_variants (
  id uuid primary key default extensions.gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  kind public.media_variant_kind not null,
  object_key text not null unique,
  mime_type text not null default 'image/webp',
  bytes bigint not null,
  width integer not null,
  height integer not null,
  created_at timestamptz not null default now(),
  unique (media_id, kind),
  constraint media_variants_mime check (mime_type = 'image/webp'),
  constraint media_variants_positive check (bytes > 0 and width > 0 and height > 0)
);

alter table public.profiles
  add constraint profiles_avatar_media_fk foreign key (avatar_media_id) references public.media(id) on delete set null,
  add constraint profiles_cover_media_fk foreign key (cover_media_id) references public.media(id) on delete set null;

create table public.vehicles (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  kind public.vehicle_kind not null,
  brand text not null,
  model text not null,
  year integer,
  nickname text,
  description text,
  visibility public.vehicle_visibility not null default 'public',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_brand_length check (char_length(btrim(brand)) between 1 and 80),
  constraint vehicles_model_length check (char_length(btrim(model)) between 1 and 80),
  constraint vehicles_year_range check (year is null or year between 1886 and 2100),
  constraint vehicles_nickname_length check (nickname is null or char_length(btrim(nickname)) between 1 and 80),
  constraint vehicles_description_length check (description is null or char_length(description) <= 1000)
);

create table public.vehicle_media (
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete restrict,
  position smallint not null,
  is_cover boolean not null default false,
  primary key (vehicle_id, media_id),
  unique (vehicle_id, position),
  constraint vehicle_media_position check (position between 0 and 7)
);
create unique index vehicle_media_one_cover_idx on public.vehicle_media(vehicle_id) where is_cover;

create table public.comments (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict,
  parent_id uuid references public.comments(id) on delete restrict,
  reply_to_user_id uuid references public.profiles(id) on delete set null,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_body_length check (char_length(btrim(body)) between 1 and 1000),
  constraint comments_reply_fields check (
    (parent_id is null and reply_to_user_id is null)
    or (parent_id is not null and reply_to_user_id is not null)
  )
);

create table public.post_marker_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  position smallint not null,
  event_id uuid references public.events(id) on delete restrict,
  photographer_spot_id uuid references public.photographer_spots(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (post_id, position),
  constraint post_marker_tags_position check (position between 0 and 4),
  constraint post_marker_tags_target check (
    (event_id is not null and photographer_spot_id is null)
    or (event_id is null and photographer_spot_id is not null)
  )
);

create unique index post_marker_tags_unique_event
  on public.post_marker_tags (post_id, event_id)
  where event_id is not null;
create unique index post_marker_tags_unique_spot
  on public.post_marker_tags (post_id, photographer_spot_id)
  where photographer_spot_id is not null;

create table public.market_products (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  price_satang integer not null,
  currency text not null default 'THB',
  category text not null,
  vehicle_kinds public.vehicle_kind[] not null,
  cover_media_id uuid references public.media(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_products_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint market_products_price_range check (price_satang between 0 and 1000000000),
  constraint market_products_currency check (currency = 'THB'),
  constraint market_products_category_length check (char_length(btrim(category)) between 1 and 80),
  constraint market_products_vehicle_kinds check (cardinality(vehicle_kinds) between 1 and 3)
);

create index media_owner_created_idx on public.media(owner_id, created_at desc) where deleted_at is null;
create index vehicles_owner_created_idx on public.vehicles(owner_id, created_at desc) where archived_at is null;
create index comments_post_created_idx on public.comments(post_id, created_at);
create index comments_parent_created_idx on public.comments(parent_id, created_at) where parent_id is not null;
create index market_products_created_idx on public.market_products(created_at desc) where deleted_at is null;
create index market_products_owner_created_idx on public.market_products(owner_id, created_at desc);

create or replace function private.enforce_comment_thread()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare parent_comment public.comments;
begin
  if new.parent_id is null then return new; end if;
  select * into parent_comment from public.comments where id = new.parent_id;
  if parent_comment.id is null or parent_comment.post_id <> new.post_id or parent_comment.parent_id is not null then
    raise exception using errcode = '23514', message = 'comment_parent_invalid';
  end if;
  return new;
end;
$$;

create trigger enforce_comment_thread
before insert or update of parent_id, post_id on public.comments
for each row execute function private.enforce_comment_thread();

create or replace function private.scrub_deleted_comment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    new.body := '[deleted]';
  end if;
  return new;
end;
$$;

create trigger scrub_deleted_comment
before update of deleted_at on public.comments
for each row execute function private.scrub_deleted_comment();

create or replace function private.validate_profile_media()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.avatar_media_id is not null and not exists (
    select 1 from public.media
    where id = new.avatar_media_id and owner_id = new.id and purpose = 'avatar'
      and status = 'ready' and deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'profile_avatar_media_invalid';
  end if;
  if new.cover_media_id is not null and not exists (
    select 1 from public.media
    where id = new.cover_media_id and owner_id = new.id and purpose = 'cover'
      and status = 'ready' and deleted_at is null
  ) then
    raise exception using errcode = '23514', message = 'profile_cover_media_invalid';
  end if;
  return new;
end;
$$;

create trigger validate_profile_media
before update of avatar_media_id, cover_media_id on public.profiles
for each row execute function private.validate_profile_media();

create trigger set_media_updated_at before update on public.media for each row execute function public.set_updated_at();
create trigger set_vehicles_updated_at before update on public.vehicles for each row execute function public.set_updated_at();
create trigger set_comments_updated_at before update on public.comments for each row execute function public.set_updated_at();
create trigger set_market_products_updated_at before update on public.market_products for each row execute function public.set_updated_at();

create or replace function public.complete_media_upload(target_media_id uuid, expected_owner_id uuid, message jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare message_id bigint;
begin
  update public.media
  set status = 'processing'
  where id = target_media_id and owner_id = expected_owner_id and status = 'uploading' and deleted_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'media_upload_not_found'; end if;
  select public.enqueue_job('media_processing', message, 0) into message_id;
  return message_id;
end;
$$;

create or replace function public.finish_media_processing(target_media_id uuid, source_width integer, source_height integer, variants jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(variants) is distinct from 'array' or jsonb_array_length(variants) <> 2 then
    raise exception using errcode = '22023', message = 'media_variants_invalid';
  end if;
  delete from public.media_variants where media_id = target_media_id;
  insert into public.media_variants(media_id, kind, object_key, bytes, width, height)
  select target_media_id, item.kind::public.media_variant_kind, item.object_key, item.bytes, item.width, item.height
  from jsonb_to_recordset(variants) as item(kind text, object_key text, bytes bigint, width integer, height integer);
  update public.media set status='ready', width=source_width, height=source_height, failure_reason=null
  where id=target_media_id and status='processing' and deleted_at is null;
  if not found then raise exception using errcode='P0002', message='media_processing_not_found'; end if;
end;
$$;

create or replace function public.save_post_with_markers(target_post_id uuid, post_body text, marker_tags jsonb)
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
    insert into public.posts(author_id, body)
    values ((select auth.uid()), post_body)
    returning id into saved_id;
  else
    update public.posts set body = post_body
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

create or replace function public.save_vehicle_with_media(target_vehicle_id uuid, vehicle_input jsonb, media_ids uuid[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare saved_id uuid;
begin
  media_ids := coalesce(media_ids, array[]::uuid[]);
  if cardinality(media_ids) > 8
    or cardinality(media_ids) <> (select count(distinct media_id) from unnest(media_ids) media_id)
    or cardinality(media_ids) <> (
      select count(*) from public.media
      where id = any(media_ids) and owner_id = (select auth.uid())
        and purpose = 'vehicle' and status = 'ready' and deleted_at is null
    ) then
    raise exception using errcode = '22023', message = 'vehicle_media_invalid';
  end if;

  if target_vehicle_id is null then
    insert into public.vehicles(owner_id, kind, brand, model, year, nickname, description, visibility)
    values (
      (select auth.uid()), (vehicle_input->>'kind')::public.vehicle_kind,
      vehicle_input->>'brand', vehicle_input->>'model', (vehicle_input->>'year')::integer,
      vehicle_input->>'nickname', vehicle_input->>'description',
      (vehicle_input->>'visibility')::public.vehicle_visibility
    ) returning id into saved_id;
  else
    update public.vehicles set
      kind = (vehicle_input->>'kind')::public.vehicle_kind,
      brand = vehicle_input->>'brand', model = vehicle_input->>'model',
      year = (vehicle_input->>'year')::integer, nickname = vehicle_input->>'nickname',
      description = vehicle_input->>'description',
      visibility = (vehicle_input->>'visibility')::public.vehicle_visibility
    where id = target_vehicle_id and archived_at is null
    returning id into saved_id;
    if saved_id is null then raise exception using errcode = 'P0002', message = 'vehicle_not_found'; end if;
  end if;

  delete from public.vehicle_media where vehicle_id = saved_id;
  insert into public.vehicle_media(vehicle_id, media_id, position, is_cover)
  select saved_id, media_id, (ordinality - 1)::smallint, ordinality = 1
  from unnest(media_ids) with ordinality as links(media_id, ordinality);
  return saved_id;
end;
$$;

alter table public.media enable row level security;
alter table public.media_variants enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_media enable row level security;
alter table public.comments enable row level security;
alter table public.post_marker_tags enable row level security;
alter table public.market_products enable row level security;

revoke all on table public.media, public.media_variants, public.vehicles, public.vehicle_media,
  public.comments, public.post_marker_tags, public.market_products from public, anon, authenticated;
grant select on table public.vehicles, public.vehicle_media, public.comments, public.post_marker_tags, public.market_products to anon;
grant select, insert on table public.media to authenticated;
grant select, insert, update, delete on table public.vehicle_media, public.post_marker_tags to authenticated;
grant select, insert, update on table public.vehicles, public.comments, public.market_products to authenticated;
grant select on table public.media_variants to authenticated;
grant all on table public.media, public.media_variants, public.vehicles, public.vehicle_media,
  public.comments, public.post_marker_tags, public.market_products to service_role;
grant update (avatar_media_id, cover_media_id) on table public.profiles to authenticated;
revoke all on function public.complete_media_upload(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_media_upload(uuid, uuid, jsonb) to service_role;
revoke all on function public.finish_media_processing(uuid, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.finish_media_processing(uuid, integer, integer, jsonb) to service_role;
revoke all on function public.save_post_with_markers(uuid, text, jsonb) from public, anon;
grant execute on function public.save_post_with_markers(uuid, text, jsonb) to authenticated, service_role;
revoke all on function public.save_vehicle_with_media(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.save_vehicle_with_media(uuid, jsonb, uuid[]) to authenticated, service_role;

create policy media_owner_select on public.media for select to authenticated
using ((select auth.uid()) = owner_id);
create policy media_owner_insert on public.media for insert to authenticated
with check ((select auth.uid()) = owner_id and status = 'uploading');
create policy media_owner_update on public.media for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
create policy media_owner_delete on public.media for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy media_variants_owner_select on public.media_variants for select to authenticated
using (exists (select 1 from public.media where media.id = media_variants.media_id and media.owner_id = (select auth.uid())));

create policy vehicles_public_select on public.vehicles for select to anon
using (visibility = 'public' and archived_at is null);
create policy vehicles_visible_select on public.vehicles for select to authenticated
using ((visibility = 'public' and archived_at is null) or owner_id = (select auth.uid()));
create policy vehicles_owner_insert on public.vehicles for insert to authenticated
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.profiles where profiles.id = vehicles.owner_id
    and profiles.username is not null and profiles.display_name is not null
));
create policy vehicles_owner_update on public.vehicles for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.profiles where profiles.id = vehicles.owner_id
    and profiles.username is not null and profiles.display_name is not null
));

create policy vehicle_media_public_select on public.vehicle_media for select to anon
using (exists (select 1 from public.vehicles where vehicles.id = vehicle_media.vehicle_id and vehicles.visibility = 'public' and vehicles.archived_at is null));
create policy vehicle_media_visible_select on public.vehicle_media for select to authenticated
using (exists (select 1 from public.vehicles where vehicles.id = vehicle_media.vehicle_id and ((vehicles.visibility = 'public' and vehicles.archived_at is null) or vehicles.owner_id = (select auth.uid()))));
create policy vehicle_media_owner_insert on public.vehicle_media for insert to authenticated
with check (
  exists (select 1 from public.vehicles where vehicles.id = vehicle_media.vehicle_id and vehicles.owner_id = (select auth.uid()))
  and exists (select 1 from public.media where media.id = vehicle_media.media_id and media.owner_id = (select auth.uid()) and media.status = 'ready')
);
create policy vehicle_media_owner_update on public.vehicle_media for update to authenticated
using (exists (select 1 from public.vehicles where vehicles.id = vehicle_media.vehicle_id and vehicles.owner_id = (select auth.uid())))
with check (
  exists (select 1 from public.vehicles where vehicles.id = vehicle_media.vehicle_id and vehicles.owner_id = (select auth.uid()))
  and exists (select 1 from public.media where media.id = vehicle_media.media_id
    and media.owner_id = (select auth.uid()) and media.status = 'ready'
    and media.purpose = 'vehicle' and media.deleted_at is null)
);
create policy vehicle_media_owner_delete on public.vehicle_media for delete to authenticated
using (exists (select 1 from public.vehicles where vehicles.id = vehicle_media.vehicle_id and vehicles.owner_id = (select auth.uid())));

create policy comments_public_select on public.comments for select to anon
using (exists (select 1 from public.posts where posts.id = comments.post_id and posts.deleted_at is null));
create policy comments_visible_select on public.comments for select to authenticated
using (exists (select 1 from public.posts where posts.id = comments.post_id and posts.deleted_at is null) or author_id = (select auth.uid()));
create policy comments_owner_insert on public.comments for insert to authenticated
with check (author_id = (select auth.uid()) and exists (select 1 from public.posts where posts.id = comments.post_id and posts.deleted_at is null));
create policy comments_owner_update on public.comments for update to authenticated
using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

create policy post_marker_tags_public_select on public.post_marker_tags for select to anon
using (exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and posts.deleted_at is null));
create policy post_marker_tags_visible_select on public.post_marker_tags for select to authenticated
using (exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and (posts.deleted_at is null or posts.author_id = (select auth.uid()))));
create policy post_marker_tags_owner_insert on public.post_marker_tags for insert to authenticated
with check (
  exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and posts.author_id = (select auth.uid()) and posts.deleted_at is null)
  and (
    (post_marker_tags.event_id is not null and exists (select 1 from public.events where events.id = post_marker_tags.event_id and events.deleted_at is null))
    or (post_marker_tags.photographer_spot_id is not null and exists (select 1 from public.photographer_spots where photographer_spots.id = post_marker_tags.photographer_spot_id and photographer_spots.deleted_at is null))
  )
);
create policy post_marker_tags_owner_update on public.post_marker_tags for update to authenticated
using (exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and posts.author_id = (select auth.uid())))
with check (exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and posts.author_id = (select auth.uid())));
create policy post_marker_tags_owner_delete on public.post_marker_tags for delete to authenticated
using (exists (select 1 from public.posts where posts.id = post_marker_tags.post_id and posts.author_id = (select auth.uid())));

create policy market_products_public_select on public.market_products for select to anon
using (deleted_at is null);
create policy market_products_visible_select on public.market_products for select to authenticated
using (deleted_at is null or owner_id = (select auth.uid()));
create policy market_products_owner_insert on public.market_products for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (cover_media_id is null or exists (
    select 1 from public.media where media.id = market_products.cover_media_id
      and media.owner_id = (select auth.uid()) and media.purpose = 'market'
      and media.status = 'ready' and media.deleted_at is null
  ))
);
create policy market_products_owner_update on public.market_products for update to authenticated
using (owner_id = (select auth.uid()))
with check (
  owner_id = (select auth.uid())
  and (cover_media_id is null or exists (
    select 1 from public.media where media.id = market_products.cover_media_id
      and media.owner_id = (select auth.uid()) and media.purpose = 'market'
      and media.status = 'ready' and media.deleted_at is null
  ))
);

revoke all on function private.enforce_comment_thread() from public, anon, authenticated, service_role;
revoke all on function private.scrub_deleted_comment() from public, anon, authenticated, service_role;
revoke all on function private.validate_profile_media() from public, anon, authenticated, service_role;
