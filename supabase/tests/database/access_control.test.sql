begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(107);

select has_enum('public', 'community_category', 'community category enum exists');
select has_enum('public', 'account_role', 'account role enum exists');
select has_enum('public', 'account_status', 'account status enum exists');
select has_table('public', 'account_access', 'account access table exists');
select has_table('public', 'admin_audit_log', 'admin audit log exists');
select ok((select relrowsecurity from pg_class where oid = 'public.account_access'::regclass), 'account access has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.admin_audit_log'::regclass), 'admin audit log has RLS');
select col_not_null('public', 'posts', 'community_category', 'posts require a community category');
select col_hasnt_default('public', 'posts', 'community_category', 'posts do not retain a category default');
select ok(not has_table_privilege('authenticated', 'public.account_access', 'select'), 'clients cannot read account access rows');
select ok(not has_table_privilege('authenticated', 'public.account_access', 'insert'), 'clients cannot create account access rows');
select ok(not has_table_privilege('authenticated', 'public.account_access', 'update'), 'clients cannot change account access rows');
select ok(not has_table_privilege('authenticated', 'public.account_access', 'delete'), 'clients cannot remove account access rows');
select ok(not has_table_privilege('authenticated', 'public.admin_audit_log', 'select'), 'clients cannot read audit rows');
select ok(not has_table_privilege('authenticated', 'public.admin_audit_log', 'insert'), 'clients cannot create audit rows');
select ok(not has_table_privilege('authenticated', 'public.admin_audit_log', 'update'), 'clients cannot change audit rows');
select ok(not has_table_privilege('authenticated', 'public.admin_audit_log', 'delete'), 'clients cannot remove audit rows');
select ok(not has_table_privilege('authenticated', 'private.moderation_audit_suppression', 'insert'), 'clients cannot set moderation audit suppression context');
select ok(not has_table_privilege('service_role', 'private.moderation_audit_suppression', 'insert'), 'the service request cannot set suppression context outside the moderation RPC');
select ok(has_schema_privilege('anon', 'private', 'usage'), 'anon can resolve private policy helpers');
select ok(has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated can resolve private policy helpers');
select ok(has_function_privilege('anon', 'private.is_admin()', 'execute'), 'anon can execute the admin policy helper');
select ok(has_function_privilege('authenticated', 'private.is_admin()', 'execute'), 'authenticated can execute the admin policy helper');
select ok(has_function_privilege('authenticated', 'private.can_write()', 'execute'), 'authenticated can execute the write policy helper');
select ok((select prosecdef from pg_proc where oid = 'private.is_admin()'::regprocedure), 'admin helper is security definer');
select ok(coalesce((select proconfig @> array['search_path=""'] from pg_proc where oid = 'private.is_admin()'::regprocedure), false), 'admin helper has an empty search path');
select ok((select prosecdef from pg_proc where oid = 'private.can_write()'::regprocedure), 'write helper is security definer');
select ok(coalesce((select proconfig @> array['search_path=""'] from pg_proc where oid = 'private.can_write()'::regprocedure), false), 'write helper has an empty search path');

insert into auth.users (id, email)
values ('30000000-0000-4000-8000-000000000003', 'access.trigger@iride.test');
select is(
  (select status::text from public.account_access where user_id = '30000000-0000-4000-8000-000000000003'),
  'locked',
  'new auth users are locked'
);

update public.profiles set username = 'access_owner', display_name = 'Access Owner' where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set username = 'access_other', display_name = 'Access Other' where id = '20000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$insert into public.posts(author_id, body, community_category) values ('10000000-0000-4000-8000-000000000001', 'Locked cannot post', 'groups')$$,
  '42501', null, 'locked owners cannot create content'
);
update public.profiles set bio = 'Still editable while locked' where id = '10000000-0000-4000-8000-000000000001';
select is((select bio from public.profiles where id = '10000000-0000-4000-8000-000000000001'), 'Still editable while locked', 'locked owners can update their own profile');
reset role;

update public.account_access set status = 'active' where user_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.save_post_with_markers(null::uuid, 'No category', '[]'::jsonb)$$,
  '42883', null, 'post save requires an explicit community category'
);
insert into public.posts(id, author_id, body, community_category)
values ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Active owner post', 'groups');
select is((select body from public.posts where id = '40000000-0000-4000-8000-000000000004'), 'Active owner post', 'active owners can create content');
insert into public.posts(id, author_id, body, community_category)
values ('41000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', 'Owner-only deletion', 'groups');
update public.posts set deleted_at = now() where id = '41000000-0000-4000-8000-000000000014';
select is(
  (select count(*)::integer from public.admin_audit_log where target_id = '41000000-0000-4000-8000-000000000014'),
  0,
  'generic owner deletes are never recorded as administrator moderation'
);
insert into public.events(id, organizer_id, kind, title, location_label, latitude, longitude, starts_at, timezone, vehicle_kinds)
values ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'meeting', 'Owner event', 'Bangkok', 13.75, 100.5, now() + interval '1 day', 'Asia/Bangkok', array['car']::public.vehicle_kind[]);
insert into public.photographer_spots(id, owner_id, title, location_label, latitude, longitude, starts_at, ends_at, timezone)
values ('60000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'Owner spot', 'Bangkok', 13.75, 100.5, now() + interval '1 day', now() + interval '1 day 1 hour', 'Asia/Bangkok');
insert into public.comments(id, post_id, author_id, body)
values ('70000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Owner comment');
reset role;

set local role service_role;
insert into public.media(id, owner_id, purpose, status, original_object_key, filename, mime_type, bytes)
values ('71000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 'vehicle', 'ready', 'users/access/vehicle', 'access.webp', 'image/webp', 10);
reset role;
insert into public.events(id, organizer_id, kind, title, location_label, latitude, longitude, starts_at, timezone, vehicle_kinds)
values
  ('50000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000002', 'meeting', 'Marker target', 'Bangkok', 13.75, 100.5, now() + interval '1 day', 'Asia/Bangkok', array['car']::public.vehicle_kind[]),
  ('50000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000002', 'meeting', 'Deleted marker target', 'Bangkok', 13.75, 100.5, now() + interval '1 day', 'Asia/Bangkok', array['car']::public.vehicle_kind[]);
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into public.vehicles(id, owner_id, kind, brand, model, visibility)
values ('73000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'car', 'Access', 'Vehicle', 'public');
insert into public.vehicle_media(vehicle_id, media_id, position, is_cover)
values ('73000000-0000-4000-8000-000000000011', '71000000-0000-4000-8000-000000000008', 0, true);
insert into public.market_products(id, owner_id, name, price_satang, category, vehicle_kinds)
values ('74000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', 'Owner product', 100, 'Parts', array['car']::public.vehicle_kind[]);
insert into public.post_marker_tags(post_id, position, event_id)
values ('40000000-0000-4000-8000-000000000004', 0, '50000000-0000-4000-8000-000000000009');
reset role;
set local role anon;
select is((select count(*)::integer from public.post_marker_tags where post_id = '40000000-0000-4000-8000-000000000004'), 1, 'marker tag is public while its event target is visible');
reset role;
update public.events set deleted_at = now() where id = '50000000-0000-4000-8000-000000000010';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$update public.post_marker_tags set event_id = '50000000-0000-4000-8000-000000000010' where post_id = '40000000-0000-4000-8000-000000000004' and position = 0$$,
  '42501', null, 'owners cannot update a marker tag to a deleted event'
);
reset role;
update public.events set deleted_at = now() where id = '50000000-0000-4000-8000-000000000009';
set local role anon;
select is((select count(*)::integer from public.post_marker_tags where post_id = '40000000-0000-4000-8000-000000000004'), 0, 'marker tags hide when their event target is deleted');
reset role;
update public.events set deleted_at = null where id = '50000000-0000-4000-8000-000000000009';
update public.account_access set status = 'suspended' where user_id = '20000000-0000-4000-8000-000000000002';
set local role anon;
select is((select count(*)::integer from public.post_marker_tags where post_id = '40000000-0000-4000-8000-000000000004'), 0, 'marker tags hide when their event owner is suspended');
reset role;

update public.account_access set role = 'admin', status = 'active' where user_id = '20000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
update public.posts set body = 'Admin managed post' where id = '40000000-0000-4000-8000-000000000004';
select is((select body from public.posts where id = '40000000-0000-4000-8000-000000000004'), 'Admin managed post', 'admins can update another owner content');
reset role;

select has_function('public', 'delete_admin_moderated_resource', array['uuid', 'uuid', 'text'], 'admin moderation delete function exists');
select ok(not has_function_privilege('authenticated', 'public.delete_admin_moderated_resource(uuid,uuid,text)', 'execute'), 'clients cannot invoke the admin moderation delete function');
select ok(
  (select status is not null and transition_id is null from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'),
  'migration normalization leaves non-pending account statuses intact'
);
set local role service_role;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
insert into public.events(id, organizer_id, kind, title, location_label, latitude, longitude, starts_at, timezone, vehicle_kinds)
values ('51000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000001', 'meeting', 'Moderated event', 'Bangkok', 13.75, 100.5, now() + interval '1 day', 'Asia/Bangkok', array['car']::public.vehicle_kind[]);
select lives_ok(
  $$select public.delete_admin_moderated_resource('20000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000015', 'event')$$,
  'service-role moderation deletes the resource through one database transaction'
);
reset role;
select ok((select deleted_at is not null from public.events where id = '51000000-0000-4000-8000-000000000015'), 'admin moderation soft-deletes the selected resource');
select ok(
  (select before_state->>'title' = 'Moderated event' and after_state ? 'deleted_at' from public.admin_audit_log where admin_id = '20000000-0000-4000-8000-000000000002' and target_id = '51000000-0000-4000-8000-000000000015' and action = 'moderation_delete'),
  'admin moderation records before and after state atomically'
);
select is(
  (select count(*)::integer from public.admin_audit_log where target_id = '51000000-0000-4000-8000-000000000015' and action in ('moderation_delete', 'admin_delete')),
  1,
  'explicit moderation remains exactly once when the service request retains the administrator JWT subject'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into public.posts(id, author_id, body, community_category)
values ('42000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000001', 'Generic admin post', 'groups');
insert into public.events(id, organizer_id, kind, title, location_label, latitude, longitude, starts_at, timezone, vehicle_kinds)
values
  ('52000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000001', 'event', 'Generic admin event', 'Bangkok', 13.75, 100.5, now() + interval '1 day', 'Asia/Bangkok', array['car']::public.vehicle_kind[]),
  ('53000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000001', 'trip', 'Generic admin trip', 'Bangkok', 13.75, 100.5, now() + interval '1 day', 'Asia/Bangkok', array['car']::public.vehicle_kind[]);
insert into public.photographer_spots(id, owner_id, title, location_label, latitude, longitude, starts_at, ends_at, timezone)
values ('62000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000001', 'Generic admin spot', 'Bangkok', 13.75, 100.5, now() + interval '1 day', now() + interval '1 day 1 hour', 'Asia/Bangkok');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
update public.posts set deleted_at = now() where id = '42000000-0000-4000-8000-000000000016';
update public.events set deleted_at = now() where id in ('52000000-0000-4000-8000-000000000017', '53000000-0000-4000-8000-000000000018');
update public.photographer_spots set deleted_at = now() where id = '62000000-0000-4000-8000-000000000019';
reset role;
select is(
  (select count(*)::integer from public.admin_audit_log where admin_id = '20000000-0000-4000-8000-000000000002' and action = 'admin_delete' and target_id in ('42000000-0000-4000-8000-000000000016', '52000000-0000-4000-8000-000000000017', '53000000-0000-4000-8000-000000000018', '62000000-0000-4000-8000-000000000019')),
  4,
  'generic admin post, event, trip, and photographer spot deletes are each audited exactly once'
);

set local role service_role;
insert into public.events(id, organizer_id, kind, title, location_label, latitude, longitude, starts_at, timezone, vehicle_kinds)
values ('54000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000002', 'event', 'Other owner event', 'Bangkok', 13.75, 100.5, now() + interval '1 day', 'Asia/Bangkok', array['car']::public.vehicle_kind[]);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
update public.events set deleted_at = now() where id = '54000000-0000-4000-8000-000000000020';
reset role;
select ok((select deleted_at is null from public.events where id = '54000000-0000-4000-8000-000000000020'), 'non-admin generic deletes of another owner resource are denied');

set local role service_role;
insert into public.media(id, owner_id, purpose, status, original_object_key, filename, mime_type, bytes)
values ('76000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000001', 'vehicle', 'ready', 'users/access/generic-admin-vehicle', 'generic-admin-vehicle.webp', 'image/webp', 10);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into public.vehicles(id, owner_id, kind, brand, model, visibility)
values ('77000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000001', 'car', 'Generic', 'Admin Vehicle', 'public');
insert into public.vehicle_media(vehicle_id, media_id, position, is_cover)
values ('77000000-0000-4000-8000-000000000022', '76000000-0000-4000-8000-000000000021', 0, true);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.delete_vehicle_permanently('77000000-0000-4000-8000-000000000022')$$, 'generic admin vehicle deletion performs permanent cleanup');
reset role;
select is((select count(*)::integer from public.vehicles where id = '77000000-0000-4000-8000-000000000022') + (select count(*)::integer from public.media where id = '76000000-0000-4000-8000-000000000021'), 0, 'generic admin vehicle deletion removes the vehicle and orphan media');
select is((select count(*)::integer from public.admin_audit_log where admin_id = '20000000-0000-4000-8000-000000000002' and target_id = '77000000-0000-4000-8000-000000000022' and action = 'admin_delete'), 1, 'generic admin vehicle deletion is audited exactly once');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into public.vehicles(id, owner_id, kind, brand, model, visibility)
values ('78000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000001', 'car', 'Owner', 'Only Vehicle', 'public');
select lives_ok($$select public.delete_vehicle_permanently('78000000-0000-4000-8000-000000000023')$$, 'owner vehicle deletion remains available');
reset role;
select is((select count(*)::integer from public.admin_audit_log where target_id = '78000000-0000-4000-8000-000000000023'), 0, 'ordinary owner vehicle deletes are not audited as moderation');

update public.account_access set status = 'suspended' where user_id = '10000000-0000-4000-8000-000000000001';
set local role anon;
select is((select count(*)::integer from public.posts where id = '40000000-0000-4000-8000-000000000004'), 0, 'suspended owner content is hidden publicly');
select is((select count(*)::integer from public.profiles where id = '10000000-0000-4000-8000-000000000001'), 0, 'suspended profile is hidden publicly');
select is((select count(*)::integer from public.events where id = '50000000-0000-4000-8000-000000000005'), 0, 'suspended owner events are hidden publicly');
select is((select count(*)::integer from public.photographer_spots where id = '60000000-0000-4000-8000-000000000006'), 0, 'suspended owner spots are hidden publicly');
select is((select count(*)::integer from public.comments where id = '70000000-0000-4000-8000-000000000007'), 0, 'suspended owner comments are hidden publicly');
select is((select count(*)::integer from public.vehicles where id = '73000000-0000-4000-8000-000000000011'), 0, 'suspended owner vehicles are hidden publicly');
select is((select count(*)::integer from public.vehicle_media where vehicle_id = '73000000-0000-4000-8000-000000000011'), 0, 'suspended owner vehicle media is hidden publicly');
select is((select count(*)::integer from public.market_products where id = '74000000-0000-4000-8000-000000000012'), 0, 'suspended owner products are hidden publicly');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.media where id = '71000000-0000-4000-8000-000000000008'), 0, 'suspended owners cannot read their media');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.posts where id = '40000000-0000-4000-8000-000000000004'), 1, 'admins can inspect suspended content');
select is((select count(*)::integer from public.profiles where id = '10000000-0000-4000-8000-000000000001'), 1, 'admins can inspect suspended profiles');
select is((select count(*)::integer from public.events where id = '50000000-0000-4000-8000-000000000005'), 1, 'admins can inspect suspended events');
select is((select count(*)::integer from public.photographer_spots where id = '60000000-0000-4000-8000-000000000006'), 1, 'admins can inspect suspended spots');
select is((select count(*)::integer from public.comments where id = '70000000-0000-4000-8000-000000000007'), 1, 'admins can inspect suspended comments');
select is((select count(*)::integer from public.vehicles where id = '73000000-0000-4000-8000-000000000011'), 1, 'admins can inspect suspended vehicles');
select is((select count(*)::integer from public.vehicle_media where vehicle_id = '73000000-0000-4000-8000-000000000011'), 1, 'admins can inspect suspended vehicle media');
select is((select count(*)::integer from public.media where id = '71000000-0000-4000-8000-000000000008'), 1, 'admins can inspect suspended media');
select is((select count(*)::integer from public.market_products where id = '74000000-0000-4000-8000-000000000012'), 1, 'admins can inspect suspended products');
reset role;

select has_column('public', 'account_access', 'transition_id', 'access transitions persist a token');
select has_column('public', 'account_access', 'transition_previous_status', 'access transitions persist their prior status');
select has_column('public', 'account_access', 'transition_action', 'access transitions persist their action');
select has_column('public', 'account_access', 'transition_started_at', 'access transitions persist their start time');
select has_function('public', 'begin_account_access_transition', array['uuid', 'text', 'uuid'], 'begin transition function exists');
select has_function('public', 'finalize_account_access_transition', array['uuid', 'uuid', 'uuid'], 'finalize transition function exists');
select has_function('public', 'rollback_account_access_transition', array['uuid', 'uuid', 'uuid'], 'rollback transition function exists');
select throws_ok(
  $$select public.begin_account_access_transition('10000000-0000-4000-8000-000000000001', 'unlock', '20000000-0000-4000-8000-000000000002')$$,
  'P0001', 'invalid_transition', 'invalid account transitions are rejected atomically'
);
select lives_ok(
  $$select public.begin_account_access_transition('10000000-0000-4000-8000-000000000001', 'restore', '20000000-0000-4000-8000-000000000002')$$,
  'an active admin can begin a restore transition'
);
select is(
  (select status::text from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'),
  'active', 'begin transition changes the account status before Auth synchronization'
);
select throws_ok(
  $$select public.begin_account_access_transition('10000000-0000-4000-8000-000000000001', 'lock', '20000000-0000-4000-8000-000000000002')$$,
  'P0001', 'transition_in_progress', 'concurrent same-target transitions are rejected'
);
select throws_ok(
  $$select public.finalize_account_access_transition('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000000')$$,
  'P0001', 'transition_token_mismatch', 'a stale token cannot finalize a transition'
);
select lives_ok(
  $$select public.rollback_account_access_transition('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', (select transition_id from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'))$$,
  'matching transition token can roll back a pending transition'
);
select is(
  (select status::text from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'),
  'suspended', 'rollback restores the persisted prior status without ABA overwrite'
);
select lives_ok(
  $$select public.begin_account_access_transition('10000000-0000-4000-8000-000000000001', 'restore', '20000000-0000-4000-8000-000000000002')$$,
  'a new transition can begin after rollback clears its token'
);
select lives_ok(
  $$select public.finalize_account_access_transition('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', (select transition_id from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'))$$,
  'matching token finalizes the pending transition'
);
select is(
  (select status::text from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'),
  'active', 'finalize retains the transitioned status and clears pending state'
);
select throws_ok(
  $$select public.finalize_account_access_transition('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', null)$$,
  'P0001', 'transition_token_mismatch', 'an idle target cannot be finalized with a null token'
);

set local role service_role;
insert into public.media(id, owner_id, purpose, status, original_object_key, filename, mime_type, bytes)
values ('72000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', 'avatar', 'uploading', 'users/access/race', 'race.webp', 'image/webp', 10);
update public.account_access set status = 'suspended' where user_id = '10000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.complete_media_upload('72000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', '{}'::jsonb)$$,
  '42501', 'account_write_forbidden', 'complete media upload rejects a suspension that occurs after API authorization'
);
reset role;

select has_column('public', 'account_access', 'transition_actor_id', 'access transitions bind the initiating actor');
select has_column('public', 'account_access', 'transition_previous_role', 'access transitions retain the prior role for promotion rollback');
select has_function('public', 'begin_bootstrap_account_promotion', array['uuid'], 'tokenized bootstrap promotion function exists');
select has_function('public', 'recover_stale_account_access_transition', array['uuid', 'uuid', 'uuid', 'integer'], 'stale transition recovery function exists');
select lives_ok(
  $$select public.begin_account_access_transition('10000000-0000-4000-8000-000000000001', 'restore', '20000000-0000-4000-8000-000000000002')$$,
  'beginning a restore creates a fail-closed pending state'
);
select ok(private.is_suspended('10000000-0000-4000-8000-000000000001'), 'pending restore is treated as hidden by the visibility helper');
set local role anon;
select is((select count(*)::integer from public.posts where id = '40000000-0000-4000-8000-000000000004'), 0, 'pending restore content remains hidden publicly');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select ok(not private.can_write(), 'pending restore never confers write capability');
reset role;
update public.account_access set status = 'locked' where user_id = '20000000-0000-4000-8000-000000000002';
select lives_ok(
  $$select public.finalize_account_access_transition('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', (select transition_id from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'))$$,
  'the exact stored actor can finalize after becoming inactive'
);
select is((select status::text from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'), 'active', 'actor invalidation does not change a token-bound finalize result');
update public.account_access set status = 'active' where user_id = '20000000-0000-4000-8000-000000000002';
select lives_ok(
  $$select public.begin_account_access_transition('10000000-0000-4000-8000-000000000001', 'suspend', '20000000-0000-4000-8000-000000000002')$$,
  'a pending suspension can be made stale for recovery testing'
);
update public.account_access set transition_started_at = now() - interval '16 minutes' where user_id = '10000000-0000-4000-8000-000000000001';
select lives_ok(
  $$select public.recover_stale_account_access_transition('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', (select transition_id from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'))$$,
  'an active administrator can roll back a stale pending transition'
);
select is((select status::text from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'), 'active', 'stale recovery restores the recorded prior status');
select lives_ok(
  $$select public.begin_bootstrap_account_promotion('10000000-0000-4000-8000-000000000001')$$,
  'bootstrap promotion starts as a tokenized pending transition'
);
select throws_ok(
  $$select public.begin_account_access_transition('10000000-0000-4000-8000-000000000001', 'suspend', '20000000-0000-4000-8000-000000000002')$$,
  'P0001', 'transition_in_progress', 'promotion and user transitions cannot race on the same target'
);
select lives_ok(
  $$select public.finalize_account_access_transition('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', (select transition_id from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'))$$,
  'bootstrap promotion finalizes only with its token-bound actor'
);
select is((select role::text from public.account_access where user_id = '10000000-0000-4000-8000-000000000001'), 'admin', 'bootstrap promotion persists the administrator role only after finalize');

select * from finish();
rollback;
