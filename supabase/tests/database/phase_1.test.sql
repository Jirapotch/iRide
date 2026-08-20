begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(40);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'vehicles', 'vehicles exists');
select has_table('public', 'posts', 'posts exists');
select has_table('public', 'comments', 'comments exists');
select has_table('public', 'likes', 'likes exists');
select has_table('public', 'follows', 'follows exists');
select has_column('public', 'profiles', 'cover_path', 'profiles support cover images');
select has_column('public', 'profiles', 'is_private', 'profiles support private accounts');
select has_column('public', 'follows', 'status', 'follows track request status');
select is((select file_size_limit from storage.buckets where id = 'avatars'), 3000000::bigint, 'avatar uploads are limited to 3 MB');
select is((select file_size_limit from storage.buckets where id = 'vehicle-media'), 3000000::bigint, 'vehicle uploads are limited to 3 MB');
select is((select file_size_limit from storage.buckets where id = 'post-media'), 3000000::bigint, 'post uploads are limited to 3 MB');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'owner@iride.test'),
  ('20000000-0000-0000-0000-000000000002', 'other@iride.test'),
  ('50000000-0000-0000-0000-000000000005', 'requester@iride.test');

update public.profiles set username = 'owner', display_name = 'Owner' where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set username = 'other', display_name = 'Other' where id = '20000000-0000-0000-0000-000000000002';
update public.profiles set username = 'requester', display_name = 'Requester' where id = '50000000-0000-0000-0000-000000000005';

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

select ok(
  not (select onboarding_completed from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'new profiles require onboarding'
);
select throws_ok(
  $$update public.profiles set provider_avatar_url = 'https://example.com/avatar.jpg' where id = '10000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'provider avatars are restricted to Google image hosting'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.profiles$$,
  '42501', null, 'anon cannot read profiles directly'
);
select throws_ok(
  $$select count(*) from public.vehicles$$,
  '42501', null, 'anon cannot read vehicles directly'
);
select throws_ok(
  $$select count(*) from public.posts$$,
  '42501', null, 'anon cannot read posts directly'
);
select is((select count(*)::integer from public.feed_posts()), 1, 'anon can read the safe public feed');
select results_eq(
  $$select likes_count from public.feed_posts()$$,
  array[1::bigint], 'public feed exposes aggregate like counts'
);
select results_eq(
  $$select liked_by_viewer from public.feed_posts()$$,
  array[false], 'anonymous public feed has no viewer like state'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.posts), 1, 'authenticated users can read posts');
select results_eq(
  $$select liked_by_viewer from public.feed_posts()$$,
  array[false], 'non-liking viewer has false like state'
);
update public.posts set body = 'Hijacked'
where id = '40000000-0000-0000-0000-000000000004';
select is(
  (select body from public.posts where id = '40000000-0000-0000-0000-000000000004'),
  'First drive', 'non-owner cannot update another post'
);
delete from public.posts where id = '40000000-0000-0000-0000-000000000004';
select is((select count(*)::integer from public.posts where id = '40000000-0000-0000-0000-000000000004'), 1, 'non-owner cannot delete another post');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
update public.posts set body = 'Owner update' where id = '40000000-0000-0000-0000-000000000004';
select is((select body from public.posts where id = '40000000-0000-0000-0000-000000000004'), 'Owner update', 'owner can update a post');
update public.vehicles set nickname = 'Weekend' where id = '30000000-0000-0000-0000-000000000003';
select is((select nickname from public.vehicles where id = '30000000-0000-0000-0000-000000000003'), 'Weekend', 'owner can update a vehicle');
insert into public.vehicles (id, owner_id, nickname) values ('60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Temporary');
delete from public.vehicles where id = '60000000-0000-0000-0000-000000000006';
select is((select count(*)::integer from public.vehicles where id = '60000000-0000-0000-0000-000000000006'), 0, 'owner can delete a vehicle');
select results_eq(
  $$select liked_by_viewer from public.feed_posts()$$,
  array[true], 'liking viewer has true like state'
);
reset role;

update public.profiles set is_private = true where id = '10000000-0000-0000-0000-000000000001';
set local role anon;
select is((select count(*)::integer from public.feed_posts()), 0, 'private posts are hidden from the anonymous feed');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000005', true);
select is((select count(*)::integer from public.posts), 0, 'private posts are hidden from non-followers');
insert into public.follows (follower_id, following_id, status)
values ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'pending');
select results_eq(
  $$select status from public.follows where follower_id = '50000000-0000-0000-0000-000000000005'$$,
  array['pending'::text], 'private follows begin as pending requests'
);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
update public.follows set status = 'accepted'
where follower_id = '50000000-0000-0000-0000-000000000005'
  and following_id = '10000000-0000-0000-0000-000000000001';
select results_eq(
  $$select status from public.follows where follower_id = '50000000-0000-0000-0000-000000000005'$$,
  array['accepted'::text], 'profile owners can accept requests'
);
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000005', true);
select is((select count(*)::integer from public.posts), 1, 'accepted followers can read private posts');
reset role;

delete from public.vehicles where id = '30000000-0000-0000-0000-000000000003';
select ok((select vehicle_id is null from public.posts where id = '40000000-0000-0000-0000-000000000004'), 'vehicle delete nulls post vehicle');

select * from finish();
rollback;
