-- Destination-only trips need no vehicle filter; a return leg is planned independently.
alter table public.events
  drop constraint events_vehicle_kinds_present,
  add constraint events_vehicle_kinds_present check (
    cardinality(vehicle_kinds) between (case when kind = 'trip' then 0 else 1 end) and 3
  ),
  add column return_destination jsonb,
  add column return_stops jsonb not null default '[]'::jsonb;

alter table public.events add constraint events_return_route_valid check (
  (kind = 'trip' or (return_destination is null and return_stops = '[]'::jsonb))
  and (return_destination is null or private.valid_trip_stops(jsonb_build_array(return_destination)))
  and private.valid_trip_stops(return_stops)
  and (return_destination is not null or return_stops = '[]'::jsonb)
);
