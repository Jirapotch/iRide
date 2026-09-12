begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(13);

select is((select public from storage.buckets where id = 'media'), false, 'media bucket is private');
select is((select file_size_limit from storage.buckets where id = 'media'), 10485760::bigint, 'bucket rejects uploads over 10 MiB');
select is((select allowed_mime_types from storage.buckets where id = 'media'), array['image/jpeg','image/png','image/webp'], 'bucket accepts only supported image types');
select ok((select relrowsecurity from pg_class where oid = 'public.media'::regclass), 'media RLS remains enabled');
select ok(not has_function_privilege('authenticated', 'public.finish_media_processing(uuid,integer,integer,jsonb)', 'EXECUTE'), 'browser cannot finish processing');

insert into auth.users (id, email, raw_user_meta_data)
values ('30000000-0000-4000-8000-000000000030', 'media.storage@iride.test', '{}'::jsonb);
insert into public.media (id, owner_id, purpose, original_object_key, filename, mime_type, bytes)
values ('40000000-0000-4000-8000-000000000030', '30000000-0000-4000-8000-000000000030', 'avatar', 'storage-test/original', 'avatar.png', 'image/png', 10);
select is((select storage_provider from public.media where id = '40000000-0000-4000-8000-000000000030'), 'supabase', 'new media defaults to Supabase');
select throws_ok($$update public.media set storage_provider = 'unknown' where id = '40000000-0000-4000-8000-000000000030'$$, '23514', null, 'unsupported provider is rejected');
select throws_ok($$update public.media set original_object_key = null where id = '40000000-0000-4000-8000-000000000030'$$, '23514', null, 'source key cannot disappear before cleanup is recorded');
select throws_ok($$update public.media set original_object_key = null, original_cleaned_at = now() where id = '40000000-0000-4000-8000-000000000030'$$, '23514', null, 'uploading media must retain its source');
set local role service_role;
select lives_ok($$update public.media set status = 'ready', original_object_key = null, original_cleaned_at = now() where id = '40000000-0000-4000-8000-000000000030'$$, 'ready media can record successful source cleanup');
reset role;
select lives_ok($$update public.media set storage_provider = 'r2' where id = '40000000-0000-4000-8000-000000000030'$$, 'legacy R2 provider remains valid');

-- Both cleanup producers must retain provider information before deleting metadata.
update public.account_access set status = 'active' where user_id = '30000000-0000-4000-8000-000000000030';
insert into public.vehicles (id, owner_id, kind, brand, model)
values ('50000000-0000-4000-8000-000000000030', '30000000-0000-4000-8000-000000000030', 'motorcycle', 'Honda', 'Test');
insert into public.media (id, owner_id, purpose, status, original_object_key, filename, mime_type, bytes)
values ('40000000-0000-4000-8000-000000000031', '30000000-0000-4000-8000-000000000030', 'vehicle', 'ready', 'storage-test/vehicle-original', 'vehicle.png', 'image/png', 10);
insert into public.vehicle_media (vehicle_id, media_id, position)
values ('50000000-0000-4000-8000-000000000030', '40000000-0000-4000-8000-000000000031', 0);
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000030', true);
select public.delete_vehicle_permanently('50000000-0000-4000-8000-000000000030');
select ok(exists(select 1 from pgmq.q_media_cleanup where message->'objects' @> '[{"objectKey":"storage-test/vehicle-original","storageProvider":"supabase"}]'::jsonb), 'vehicle cleanup retains Supabase provider');

update public.account_access set role = 'admin' where user_id = '30000000-0000-4000-8000-000000000030';
insert into public.vehicles (id, owner_id, kind, brand, model)
values ('50000000-0000-4000-8000-000000000031', '30000000-0000-4000-8000-000000000030', 'motorcycle', 'Honda', 'Test');
insert into public.media (id, owner_id, purpose, status, original_object_key, filename, mime_type, bytes, storage_provider)
values ('40000000-0000-4000-8000-000000000032', '30000000-0000-4000-8000-000000000030', 'vehicle', 'ready', 'storage-test/legacy-original', 'vehicle.png', 'image/png', 10, 'r2');
insert into public.vehicle_media (vehicle_id, media_id, position)
values ('50000000-0000-4000-8000-000000000031', '40000000-0000-4000-8000-000000000032', 0);
select public.delete_admin_moderated_resource('30000000-0000-4000-8000-000000000030', '50000000-0000-4000-8000-000000000031', 'vehicle');
select ok(exists(select 1 from pgmq.q_media_cleanup where message->'objects' @> '[{"objectKey":"storage-test/legacy-original","storageProvider":"r2"}]'::jsonb), 'admin cleanup retains legacy R2 provider');

select * from finish();
rollback;
