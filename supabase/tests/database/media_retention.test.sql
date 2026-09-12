begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);
insert into auth.users(id, email) values ('10000000-0000-4000-8000-000000000041', 'retention@example.test');
set local role service_role;
insert into public.media(id, owner_id, purpose, status, original_object_key, filename, mime_type, bytes)
values ('20000000-0000-4000-8000-000000000041', '10000000-0000-4000-8000-000000000041', 'avatar', 'processing', 'users/source-retention/original', 'avatar.webp', 'image/webp', 100);
select public.finish_media_processing('20000000-0000-4000-8000-000000000041', 1024, 1024,
  '[{"kind":"thumbnail","object_key":"retention/thumb.webp","bytes":10,"width":256,"height":256},{"kind":"preview","object_key":"retention/preview.webp","bytes":20,"width":512,"height":512}]');
reset role;
select is((select status::text from public.media where id='20000000-0000-4000-8000-000000000041'), 'ready', 'variants transition media to ready');
select is((select count(*)::integer from public.media_variants where media_id='20000000-0000-4000-8000-000000000041'), 2, 'both variants persist');
select is((select count(*)::integer from pgmq.q_media_cleanup where message->>'idempotencyKey'='media:20000000-0000-4000-8000-000000000041:source'), 1, 'ready atomically enqueues source cleanup');
select ok((select vt >= now() + interval '2 hours' from pgmq.q_media_cleanup where message->>'idempotencyKey'='media:20000000-0000-4000-8000-000000000041:source'), 'source remains until upload tokens can no longer replay');
select is((select message->'objects'->0->>'sourceMediaId' from pgmq.q_media_cleanup where message->>'idempotencyKey'='media:20000000-0000-4000-8000-000000000041:source'), '20000000-0000-4000-8000-000000000041', 'cleanup carries source row identity');
select is((select original_object_key from public.media where id='20000000-0000-4000-8000-000000000041'), 'users/source-retention/original', 'ready retains source key until deletion succeeds');
set local role service_role;
select lives_ok($$select public.finish_media_processing('20000000-0000-4000-8000-000000000041', 1024, 1024, '[]')$$, 'duplicate ready job is harmless');
reset role;
select is((select count(*)::integer from pgmq.q_media_cleanup where message->>'idempotencyKey'='media:20000000-0000-4000-8000-000000000041:source'), 1, 'duplicate ready completion does not enqueue again');
select ok(not has_function_privilege('authenticated', 'public.finish_media_processing(uuid,integer,integer,jsonb)', 'execute'), 'browser cannot mark ready or enqueue source removal');
-- Inject a queue failure only inside this rolled-back test transaction.
create function pg_temp.fail_retention_enqueue() returns trigger language plpgsql as $$begin raise exception 'retention_test_queue_failure'; end$$;
create trigger test_retention_enqueue before insert on pgmq.q_media_cleanup for each row execute function pg_temp.fail_retention_enqueue();
set local role service_role;
insert into public.media(id, owner_id, purpose, status, original_object_key, filename, mime_type, bytes)
values ('20000000-0000-4000-8000-000000000042', '10000000-0000-4000-8000-000000000041', 'avatar', 'processing', 'users/source-retention/rollback', 'avatar.webp', 'image/webp', 100);
select throws_ok($$select public.finish_media_processing('20000000-0000-4000-8000-000000000042', 1024, 1024,
  '[{"kind":"thumbnail","object_key":"rollback/thumb.webp","bytes":10,"width":256,"height":256},{"kind":"preview","object_key":"rollback/preview.webp","bytes":20,"width":512,"height":512}]')$$,
  'P0001', 'retention_test_queue_failure', 'queue failure aborts the ready transaction');
reset role;
select is((select status::text from public.media where id='20000000-0000-4000-8000-000000000042'), 'processing', 'queue failure does not commit ready');
select is((select count(*)::integer from public.media_variants where media_id='20000000-0000-4000-8000-000000000042'), 0, 'queue failure rolls back variant metadata too');
select * from finish();
rollback;
