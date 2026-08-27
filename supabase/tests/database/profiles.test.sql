begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(30);

select has_table('public', 'profiles', 'profiles table exists');
select has_enum('public', 'profile_visibility', 'profile visibility enum exists');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS');
select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002'
    )
  ),
  2,
  'seed identities have profiles'
);
select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002'
    )
      and username is null
  ),
  2,
  'new profiles are incomplete'
);

insert into auth.users (id, email, raw_user_meta_data)
values ('30000000-0000-4000-8000-000000000003', 'profile.trigger@iride.test', '{"name":"must not copy"}'::jsonb);
select is(
  (select count(*)::integer from public.profiles where id = '30000000-0000-4000-8000-000000000003'),
  1,
  'auth trigger creates a profile'
);
select is(
  (select display_name from public.profiles where id = '30000000-0000-4000-8000-000000000003'),
  null,
  'auth metadata is not copied'
);

update public.profiles
set username = '  OWNER_ONE  ', display_name = ' Owner One ', visibility = 'public'
where id = '10000000-0000-4000-8000-000000000001';
update public.profiles
set username = 'viewer_two', display_name = 'Viewer Two', visibility = 'private'
where id = '20000000-0000-4000-8000-000000000002';

select is(
  (select username from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  'owner_one',
  'username is canonicalized'
);
select is(
  (select display_name from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  'Owner One',
  'display name is trimmed'
);
select isnt(
  (select username_changed_at from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  null,
  'initial username records its change time'
);
select throws_ok(
  $$update public.profiles set username = 'admin' where id = '30000000-0000-4000-8000-000000000003'$$,
  '23514',
  'username_reserved',
  'reserved username is rejected'
);
select throws_ok(
  $$update public.profiles set username = 'owner_one' where id = '30000000-0000-4000-8000-000000000003'$$,
  '23505',
  null,
  'duplicate username is rejected'
);
select throws_ok(
  $$update public.profiles set username = 'new_owner' where id = '10000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'username_cooldown',
  'username cooldown is enforced'
);
select throws_ok(
  $$update public.profiles set latitude = 13.7 where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'coordinates must be stored as a pair'
);
select throws_ok(
  $$update public.profiles set latitude = 91, longitude = 100 where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'latitude is bounded'
);

select ok(has_column_privilege('anon', 'public.profiles', 'username', 'select'), 'anon has limited select access');
select ok(not has_column_privilege('anon', 'public.profiles', 'latitude', 'select'), 'anon cannot select latitude');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'longitude', 'select'), 'authenticated cannot select longitude');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'insert'), 'authenticated cannot insert profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'delete'), 'authenticated cannot delete profiles');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated cannot use private schema');

set local role anon;
select is((select count(username)::integer from public.profiles), 1, 'anon sees only complete public profiles');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
create temporary table profile_update_results (id uuid) on commit drop;
select is((select count(username)::integer from public.profiles), 1, 'owner sees own public profile but not another private profile');
update public.profiles
set bio = 'Roads and stories'
where id = '10000000-0000-4000-8000-000000000001';
select is(
  (select bio from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  'Roads and stories',
  'owner can update own profile without private schema access'
);
select is(
  (select count(*)::integer from public.profiles where id = '20000000-0000-4000-8000-000000000002'),
  0,
  'owner cannot read another private profile'
);
with changed as (
  update public.profiles set bio = 'forbidden' where id = '20000000-0000-4000-8000-000000000002' returning id
)
insert into profile_update_results select id from changed;
select is(
  (select count(*)::integer from profile_update_results),
  0,
  'owner cannot update another profile'
);
reset role;

update public.profiles set visibility = 'followers' where id = '10000000-0000-4000-8000-000000000001';
set local role anon;
select is((select count(username)::integer from public.profiles), 1, 'followers visibility is temporarily public');
reset role;

select ok(
  not (select prosecdef from pg_proc where oid = 'private.prepare_profile_write()'::regprocedure),
  'profile write trigger is security invoker'
);
select ok(
  (select prosecdef from pg_proc where oid = 'private.handle_new_user()'::regprocedure),
  'auth user trigger is security definer'
);
select ok(
  coalesce((select proconfig @> array['search_path=""'] from pg_proc where oid = 'private.handle_new_user()'::regprocedure), false),
  'auth user trigger has an empty search path'
);

select * from finish();
rollback;
