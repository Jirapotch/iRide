begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'vehicles', 'vehicles exists');
select has_table('public', 'posts', 'posts exists');
select has_table('public', 'comments', 'comments exists');
select has_table('public', 'likes', 'likes exists');
select has_table('public', 'follows', 'follows exists');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'owner@iride.test'),
  ('20000000-0000-0000-0000-000000000002', 'other@iride.test');

update public.profiles set username = 'owner', display_name = 'Owner' where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set username = 'other', display_name = 'Other' where id = '20000000-0000-0000-0000-000000000002';

insert into public.vehicles (id, owner_id, nickname, make, model, year)
values ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Daily', 'Honda', 'Civic', 2025);

insert into public.posts (id, author_id, vehicle_id, body)
values ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'First drive');

insert into public.likes (user_id, post_id) values
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004');
insert into public.follows (follower_id, following_id) values
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001');

select throws_ok(
  $$insert into public.likes (user_id, post_id) values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004')$$,
  '23505', null, 'duplicate likes are rejected'
);
select throws_ok(
  $$insert into public.follows (follower_id, following_id) values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001')$$,
  '23505', null, 'duplicate follows are rejected'
);
select throws_ok(
  $$insert into public.follows (follower_id, following_id) values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')$$,
  '23514', null, 'self-follow is rejected'
);
select throws_ok(
  $$insert into public.posts (author_id, vehicle_id, body) values ('20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'Not mine')$$,
  '23514', null, 'post vehicle must belong to author'
);

select results_eq(
  $$select followers_count from public.profile_stats('10000000-0000-0000-0000-000000000001')$$,
  array[1::bigint], 'aggregate follower count is correct'
);
select results_eq(
  $$select following_count from public.profile_stats('20000000-0000-0000-0000-000000000002')$$,
  array[1::bigint], 'aggregate following count is correct'
);

set local role anon;
select is((select count(*)::integer from public.profiles), 2, 'anon can read profiles');
select is((select count(*)::integer from public.vehicles), 1, 'anon can read vehicles');
select is((select count(*)::integer from public.posts), 0, 'anon cannot read posts');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.posts), 1, 'authenticated users can read posts');
update public.posts set body = 'Hijacked'
where id = '40000000-0000-0000-0000-000000000004';
select is(
  (select body from public.posts where id = '40000000-0000-0000-0000-000000000004'),
  'First drive', 'non-owner cannot update another post'
);
reset role;

delete from public.vehicles where id = '30000000-0000-0000-0000-000000000003';
select ok((select vehicle_id is null from public.posts where id = '40000000-0000-0000-0000-000000000004'), 'vehicle delete nulls post vehicle');

select * from finish();
rollback;
