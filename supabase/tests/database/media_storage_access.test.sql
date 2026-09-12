begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data)
values ('30000000-0000-4000-8000-000000000040', 'media.storage.access@iride.test', '{}'::jsonb);
update public.account_access set status = 'active' where user_id = '30000000-0000-4000-8000-000000000040';
set local role service_role;
insert into public.media (id, owner_id, purpose, status, original_object_key, filename, mime_type, bytes)
values ('40000000-0000-4000-8000-000000000040', '30000000-0000-4000-8000-000000000040', 'avatar', 'ready', 'users/30000000-0000-4000-8000-000000000040/avatar/40000000-0000-4000-8000-000000000040/original', 'avatar.png', 'image/png', 10);
reset role;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000040', true);
set local role authenticated;

select throws_ok($$update public.media set storage_provider = 'r2' where id = '40000000-0000-4000-8000-000000000040'$$, '42501', null, 'owner cannot reroute ready media');
select throws_ok($$update public.media set original_object_key = 'another-owner/original' where id = '40000000-0000-4000-8000-000000000040'$$, '42501', null, 'owner cannot replace the source key');
select throws_ok($$update public.media set original_object_key = null, original_cleaned_at = now() where id = '40000000-0000-4000-8000-000000000040'$$, '42501', null, 'owner cannot forge cleanup on ready media');
select throws_ok($$update public.media set status = 'uploading' where id = '40000000-0000-4000-8000-000000000040'$$, '42501', null, 'owner cannot reset processing state');
select throws_ok($$update public.media set owner_id = '10000000-0000-4000-8000-000000000001' where id = '40000000-0000-4000-8000-000000000040'$$, '42501', null, 'owner cannot reassign media ownership');
select throws_ok($$update public.media set purpose = 'cover' where id = '40000000-0000-4000-8000-000000000040'$$, '42501', null, 'owner cannot repurpose a storage path');
select throws_ok($$update public.media set width = 999, height = 999 where id = '40000000-0000-4000-8000-000000000040'$$, '42501', null, 'owner cannot forge processing metadata');

select lives_ok($$insert into public.media (id, owner_id, purpose, status, original_object_key, filename, mime_type, bytes, storage_provider) values ('40000000-0000-4000-8000-000000000041', '30000000-0000-4000-8000-000000000040', 'avatar', 'uploading', 'users/30000000-0000-4000-8000-000000000040/avatar/40000000-0000-4000-8000-000000000041/original', 'avatar.png', 'image/png', 10, 'supabase')$$, 'API owner-token upload creation remains valid');
select throws_ok($$insert into public.media (id, owner_id, purpose, original_object_key, filename, mime_type, bytes, storage_provider) values ('40000000-0000-4000-8000-000000000042', '30000000-0000-4000-8000-000000000040', 'avatar', 'users/30000000-0000-4000-8000-000000000040/avatar/40000000-0000-4000-8000-000000000042/original', 'avatar.png', 'image/png', 10, 'r2')$$, '42501', null, 'owner cannot forge a new legacy R2 upload');
select throws_ok($$insert into public.media (id, owner_id, purpose, original_object_key, filename, mime_type, bytes) values ('40000000-0000-4000-8000-000000000043', '30000000-0000-4000-8000-000000000040', 'avatar', 'users/another-owner/avatar/existing/original', 'avatar.png', 'image/png', 10)$$, '42501', null, 'owner cannot import another storage object through insert');
select throws_ok($$insert into public.media (id, owner_id, purpose, original_object_key, original_cleaned_at, status, filename, mime_type, bytes) values ('40000000-0000-4000-8000-000000000044', '30000000-0000-4000-8000-000000000040', 'avatar', null, now(), 'ready', 'avatar.png', 'image/png', 10)$$, '42501', null, 'owner cannot insert fabricated completed cleanup');
select is((select count(*)::integer from public.media where owner_id = '30000000-0000-4000-8000-000000000040'), 2, 'owner can still read legitimate media');

reset role;
set local role service_role;
select lives_ok($$update public.media set original_object_key = null, original_cleaned_at = now() where id = '40000000-0000-4000-8000-000000000040'$$, 'trusted service-role cleanup remains allowed');
reset role;
update public.account_access set role = 'admin' where user_id = '30000000-0000-4000-8000-000000000040';
set local role authenticated;
select throws_ok($$update public.media set status = 'ready' where id = '40000000-0000-4000-8000-000000000041'$$, '42501', null, 'app admin browser cannot bypass trusted media processing');
select throws_ok($$insert into public.media (id, owner_id, purpose, original_object_key, original_cleaned_at, status, filename, mime_type, bytes) values ('40000000-0000-4000-8000-000000000044', '30000000-0000-4000-8000-000000000040', 'avatar', null, now(), 'ready', 'avatar.png', 'image/png', 10)$$, '42501', null, 'restrictive insert policy also rejects app-admin cleanup forgery');
reset role;

select * from finish();
rollback;
