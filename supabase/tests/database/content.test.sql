begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

select has_table('public', 'posts', 'posts table exists');
select has_table('public', 'events', 'events table exists');
select has_table('public', 'photographer_spots', 'photographer spots table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.posts'::regclass), 'posts has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.events'::regclass), 'events has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.photographer_spots'::regclass), 'photographer spots has RLS');
select has_index('public', 'events', 'events_location_idx', 'events has a spatial index');
select has_index('public', 'photographer_spots', 'photographer_spots_location_idx', 'spots have a spatial index');

update public.profiles
set username = 'content_owner', display_name = 'Content Owner', visibility = 'public'
where id = '10000000-0000-4000-8000-000000000001';
update public.profiles
set username = 'other_owner', display_name = 'Other Owner', visibility = 'public'
where id = '20000000-0000-4000-8000-000000000002';

select ok(has_table_privilege('anon', 'public.posts', 'select'), 'anon can read posts');
select ok(not has_table_privilege('anon', 'public.posts', 'insert'), 'anon cannot create posts');
select ok(has_table_privilege('authenticated', 'public.events', 'insert'), 'authenticated can create events');
select ok(not has_table_privilege('authenticated', 'public.events', 'delete'), 'physical event deletion is unavailable');

select throws_ok(
  $$insert into public.events (
    organizer_id, kind, title, location_label, latitude, longitude, starts_at, timezone, vehicle_kinds
  ) values (
    '10000000-0000-4000-8000-000000000001', 'trip', 'Invalid trip', 'Bangkok', 13.7563, 100.5018,
    now() + interval '1 day', 'Asia/Bangkok', array['car']::public.vehicle_kind[]
  )$$,
  '23514', null, 'trip requires a destination'
);
select throws_ok(
  $$insert into public.events (
    organizer_id, kind, title, location_label, latitude, longitude, starts_at, ends_at, timezone, vehicle_kinds
  ) values (
    '10000000-0000-4000-8000-000000000001', 'event', 'Invalid time', 'Bangkok', 13.7563, 100.5018,
    now() + interval '2 days', now() + interval '1 day', 'Asia/Bangkok', array['car']::public.vehicle_kind[]
  )$$,
  '23514', null, 'event end must follow its start'
);
select throws_ok(
  $$insert into public.events (
    organizer_id, kind, title, location_label, latitude, longitude, starts_at, timezone, vehicle_kinds
  ) values (
    '10000000-0000-4000-8000-000000000001', 'meeting', 'No vehicles', 'Bangkok', 13.7563, 100.5018,
    now() + interval '1 day', 'Asia/Bangkok', array[]::public.vehicle_kind[]
  )$$,
  '23514', null, 'event requires at least one vehicle kind'
);
select throws_ok(
  $$insert into public.photographer_spots (
    owner_id, title, location_label, latitude, longitude, starts_at, ends_at, timezone
  ) values (
    '10000000-0000-4000-8000-000000000001', 'Invalid session', 'Bangkok', 13.7563, 100.5018,
    now() + interval '2 days', now() + interval '1 day', 'Asia/Bangkok'
  )$$,
  '23514', null, 'spot end must follow its start'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

insert into public.posts (id, author_id, body)
values ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'First post');
select is((select body from public.posts where id = '40000000-0000-4000-8000-000000000004'), 'First post', 'owner creates a post');

insert into public.events (
  id, organizer_id, kind, title, location_label, latitude, longitude, starts_at, timezone, vehicle_kinds
) values (
  '50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001',
  'meeting', 'Riverside meetup', 'Bangkok', 13.7563, 100.5018,
  now() + interval '1 day', 'Asia/Bangkok', array['car']::public.vehicle_kind[]
);
select is((select title from public.events where id = '50000000-0000-4000-8000-000000000005'), 'Riverside meetup', 'owner creates an event');

insert into public.photographer_spots (
  id, owner_id, title, location_label, latitude, longitude, starts_at, ends_at, timezone
) values (
  '60000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001',
  'Morning photo session', 'Bangkok', 13.8, 100.6,
  now() + interval '1 day', now() + interval '1 day 2 hours', 'Asia/Bangkok'
);
select is((select title from public.photographer_spots where id = '60000000-0000-4000-8000-000000000006'), 'Morning photo session', 'owner creates a photographer spot');

with changed as (
  update public.posts set body = 'Forbidden' where author_id = '20000000-0000-4000-8000-000000000002' returning id
)
select is((select count(*)::integer from changed), 0, 'owner cannot update another author content');

update public.posts set deleted_at = now() where id = '40000000-0000-4000-8000-000000000004';
select is((select count(*)::integer from public.posts where id = '40000000-0000-4000-8000-000000000004'), 1, 'owner can still inspect soft-deleted content');
reset role;

set local role anon;
select is((select count(*)::integer from public.posts where id = '40000000-0000-4000-8000-000000000004'), 0, 'anon cannot read soft-deleted posts');
select is((select count(*)::integer from public.events where id = '50000000-0000-4000-8000-000000000005'), 1, 'anon can read published events');
select is((select count(*)::integer from public.photographer_spots where id = '60000000-0000-4000-8000-000000000006'), 1, 'anon can read published photographer spots');
reset role;

select * from finish();
rollback;
