-- Keep existing trip origins/destinations; allow destination-only plans.
alter table public.events
  alter column location_label drop not null,
  alter column latitude drop not null,
  alter column longitude drop not null,
  alter column starts_at drop not null,
  add column stops jsonb not null default '[]'::jsonb,
  add constraint events_origin_complete check (
    (location_label is null and latitude is null and longitude is null)
    or (location_label is not null and latitude is not null and longitude is not null)
  ),
  add constraint events_activity_required check (
    kind = 'trip' or (location_label is not null and latitude is not null and longitude is not null and starts_at is not null)
  );

create function private.valid_trip_stops(points jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare point jsonb;
begin
  if jsonb_typeof(points) <> 'array' then return false; end if;
  if jsonb_array_length(points) > 20 then return false; end if;
  for point in select value from jsonb_array_elements(points) loop
    if jsonb_typeof(point) <> 'object'
      or not (point ?& array['name', 'latitude', 'longitude'])
      or point - array['name', 'latitude', 'longitude'] <> '{}'::jsonb
      or jsonb_typeof(point->'name') <> 'string'
      or char_length(btrim(point->>'name')) not between 1 and 160
      or jsonb_typeof(point->'latitude') <> 'number'
      or jsonb_typeof(point->'longitude') <> 'number'
    then return false; end if;
    if (point->>'latitude')::numeric not between -90 and 90
      or (point->>'longitude')::numeric not between -180 and 180
    then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function private.valid_trip_stops(jsonb) from public;
grant execute on function private.valid_trip_stops(jsonb) to authenticated, service_role;
alter table public.events add constraint events_stops_valid
  check (private.valid_trip_stops(stops) and (kind = 'trip' or stops = '[]'::jsonb));

create or replace function public.explore_content(
  west double precision, south double precision, east double precision, north double precision, layers text[]
)
returns table (id uuid, kind text, title text, subtitle text, latitude double precision, longitude double precision,
  starts_at timestamptz, ends_at timestamptz, author_id uuid, author_username text, author_display_name text)
language sql stable security invoker set search_path = ''
as $$
  with viewport as (select extensions.st_makeenvelope(west, south, east, north, 4326)::extensions.geography bounds)
  select e.id, e.kind::text, e.title,
    case when e.kind = 'trip' then e.destination_label else e.location_label end,
    case when e.kind = 'trip' then e.destination_latitude else e.latitude end,
    case when e.kind = 'trip' then e.destination_longitude else e.longitude end,
    e.starts_at, e.ends_at, p.id, p.username, p.display_name
  from public.events e join public.profiles p on p.id = e.organizer_id cross join viewport v
  where e.deleted_at is null
    and extensions.st_intersects(case when e.kind = 'trip' then e.destination_location else e.location end, v.bounds)
    and ((e.kind = 'trip' and 'trips' = any(layers)) or (e.kind <> 'trip' and 'events' = any(layers)));
$$;

create index events_trip_destination_idx on public.events using gist (destination_location)
  where deleted_at is null and kind = 'trip';
