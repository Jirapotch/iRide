create type public.vehicle_kind as enum ('car', 'motorcycle', 'bicycle');
create type public.event_kind as enum ('meeting', 'event', 'trip');

create table public.posts (
  id uuid primary key default extensions.gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_body_length check (char_length(btrim(body)) between 1 and 2000)
);

create table public.events (
  id uuid primary key default extensions.gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete restrict,
  kind public.event_kind not null,
  title text not null,
  description text,
  location_label text not null,
  latitude double precision not null,
  longitude double precision not null,
  location extensions.geography(Point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
  ) stored,
  destination_label text,
  destination_latitude double precision,
  destination_longitude double precision,
  destination_location extensions.geography(Point, 4326) generated always as (
    case
      when destination_latitude is null or destination_longitude is null then null
      else extensions.st_setsrid(extensions.st_makepoint(destination_longitude, destination_latitude), 4326)::extensions.geography
    end
  ) stored,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null,
  vehicle_kinds public.vehicle_kind[] not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint events_description_length check (description is null or char_length(description) <= 2000),
  constraint events_location_label_length check (char_length(btrim(location_label)) between 1 and 160),
  constraint events_latitude_range check (latitude between -90 and 90),
  constraint events_longitude_range check (longitude between -180 and 180),
  constraint events_destination_label_length check (destination_label is null or char_length(btrim(destination_label)) between 1 and 160),
  constraint events_timezone_length check (char_length(btrim(timezone)) between 1 and 64),
  constraint events_end_after_start check (ends_at is null or ends_at > starts_at),
  constraint events_vehicle_kinds_present check (cardinality(vehicle_kinds) between 1 and 3),
  constraint events_destination_pair check (
    (destination_label is null and destination_latitude is null and destination_longitude is null)
    or (destination_label is not null and destination_latitude between -90 and 90 and destination_longitude between -180 and 180)
  ),
  constraint events_trip_destination check (kind <> 'trip' or destination_label is not null)
);

create table public.photographer_spots (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  location_label text not null,
  latitude double precision not null,
  longitude double precision not null,
  location extensions.geography(Point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
  ) stored,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photographer_spots_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint photographer_spots_description_length check (description is null or char_length(description) <= 2000),
  constraint photographer_spots_location_label_length check (char_length(btrim(location_label)) between 1 and 160),
  constraint photographer_spots_latitude_range check (latitude between -90 and 90),
  constraint photographer_spots_longitude_range check (longitude between -180 and 180),
  constraint photographer_spots_timezone_length check (char_length(btrim(timezone)) between 1 and 64),
  constraint photographer_spots_end_after_start check (ends_at > starts_at)
);

create index posts_created_at_idx on public.posts (created_at desc) where deleted_at is null;
create index posts_author_created_at_idx on public.posts (author_id, created_at desc);
create index events_starts_at_idx on public.events (starts_at) where deleted_at is null;
create index events_organizer_created_at_idx on public.events (organizer_id, created_at desc);
create index events_location_idx on public.events using gist (location);
create index photographer_spots_starts_at_idx on public.photographer_spots (starts_at) where deleted_at is null;
create index photographer_spots_owner_created_at_idx on public.photographer_spots (owner_id, created_at desc);
create index photographer_spots_location_idx on public.photographer_spots using gist (location);

create trigger set_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();
create trigger set_photographer_spots_updated_at
before update on public.photographer_spots
for each row execute function public.set_updated_at();

alter table public.posts enable row level security;
alter table public.events enable row level security;
alter table public.photographer_spots enable row level security;

revoke all on table public.posts, public.events, public.photographer_spots
from public, anon, authenticated;
grant select on table public.posts, public.events, public.photographer_spots to anon;
grant select, insert, update on table public.posts, public.events, public.photographer_spots to authenticated;
grant all on table public.posts, public.events, public.photographer_spots to service_role;

create policy posts_public_read
on public.posts for select to anon
using (deleted_at is null);
create policy posts_authenticated_read
on public.posts for select to authenticated
using (deleted_at is null or (select auth.uid()) = author_id);
create policy posts_owner_insert
on public.posts for insert to authenticated
with check (
  (select auth.uid()) = author_id
  and exists (select 1 from public.profiles where id = author_id and username is not null and display_name is not null)
);
create policy posts_owner_update
on public.posts for update to authenticated
using ((select auth.uid()) = author_id)
with check (
  (select auth.uid()) = author_id
  and exists (select 1 from public.profiles where id = author_id and username is not null and display_name is not null)
);

create policy events_public_read
on public.events for select to anon
using (deleted_at is null);
create policy events_authenticated_read
on public.events for select to authenticated
using (deleted_at is null or (select auth.uid()) = organizer_id);
create policy events_owner_insert
on public.events for insert to authenticated
with check (
  (select auth.uid()) = organizer_id
  and exists (select 1 from public.profiles where id = organizer_id and username is not null and display_name is not null)
);
create policy events_owner_update
on public.events for update to authenticated
using ((select auth.uid()) = organizer_id)
with check (
  (select auth.uid()) = organizer_id
  and exists (select 1 from public.profiles where id = organizer_id and username is not null and display_name is not null)
);

create policy photographer_spots_public_read
on public.photographer_spots for select to anon
using (deleted_at is null);
create policy photographer_spots_authenticated_read
on public.photographer_spots for select to authenticated
using (deleted_at is null or (select auth.uid()) = owner_id);
create policy photographer_spots_owner_insert
on public.photographer_spots for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.profiles where id = owner_id and username is not null and display_name is not null)
);
create policy photographer_spots_owner_update
on public.photographer_spots for update to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.profiles where id = owner_id and username is not null and display_name is not null)
);

create or replace function public.explore_content(
  west double precision,
  south double precision,
  east double precision,
  north double precision,
  layers text[]
)
returns table (
  id uuid,
  kind text,
  title text,
  subtitle text,
  latitude double precision,
  longitude double precision,
  starts_at timestamptz,
  ends_at timestamptz,
  author_id uuid,
  author_username text,
  author_display_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with viewport as (
    select extensions.st_makeenvelope(west, south, east, north, 4326)::extensions.geography as bounds
  )
  select event.id,
         event.kind::text,
         event.title,
         event.location_label,
         event.latitude,
         event.longitude,
         event.starts_at,
         event.ends_at,
         profile.id,
         profile.username,
         profile.display_name
  from public.events as event
  join public.profiles as profile on profile.id = event.organizer_id
  cross join viewport
  where event.deleted_at is null
    and extensions.st_intersects(event.location, viewport.bounds)
    and (
      (event.kind = 'trip' and 'trips' = any(layers))
      or (event.kind <> 'trip' and 'events' = any(layers))
    )
  union all
  select spot.id,
         'photographerSpot',
         spot.title,
         spot.location_label,
         spot.latitude,
         spot.longitude,
         spot.starts_at,
         spot.ends_at,
         profile.id,
         profile.username,
         profile.display_name
  from public.photographer_spots as spot
  join public.profiles as profile on profile.id = spot.owner_id
  cross join viewport
  where spot.deleted_at is null
    and 'photographer-spots' = any(layers)
    and extensions.st_intersects(spot.location, viewport.bounds);
$$;

revoke all on function public.explore_content(double precision, double precision, double precision, double precision, text[])
from public, anon, authenticated;
grant execute on function public.explore_content(double precision, double precision, double precision, double precision, text[])
to service_role;
