begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(38);

select ok(exists(select 1 from pg_extension where extname = 'pgcrypto'), 'pgcrypto is enabled');
select ok(exists(select 1 from pg_extension where extname = 'postgis'), 'postgis is enabled');
select ok(exists(select 1 from pg_extension where extname = 'pgmq'), 'pgmq is enabled');
select ok(exists(select 1 from pg_extension where extname = 'pgtap'), 'pgtap is enabled');
select has_schema('private', 'private schema exists');
select has_schema('internal', 'internal schema exists');
select has_function('public', 'set_updated_at', array[]::text[], 'updated_at helper exists');
select has_function('public', 'enqueue_job', array['text', 'jsonb', 'integer'], 'enqueue helper exists');
select has_function('public', 'read_jobs', array['text', 'integer', 'integer'], 'read helper exists');
select has_function('public', 'archive_job', array['text', 'bigint'], 'archive helper exists');

select ok(
  not (select prosecdef from pg_proc where oid = 'public.set_updated_at()'::regprocedure),
  'updated_at helper is security invoker'
);
select ok(
  coalesce((select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.set_updated_at()'::regprocedure), false),
  'updated_at helper has an empty search_path'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.enqueue_job(text,jsonb,integer)'::regprocedure),
  'enqueue helper is security definer'
);
select ok(
  coalesce((select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.enqueue_job(text,jsonb,integer)'::regprocedure), false),
  'enqueue helper has an empty search_path'
);

select is(
  (select count(*)::integer
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not c.relrowsecurity),
  0,
  'every public table has RLS enabled'
);
select ok((select relrowsecurity from pg_class where oid = 'pgmq.q_media_processing'::regclass), 'active queue has RLS');
select ok((select relrowsecurity from pg_class where oid = 'pgmq.a_media_processing'::regclass), 'archive queue has RLS');
select ok(exists(select 1 from pg_publication where pubname = 'supabase_realtime'), 'Realtime publication exists');

select ok(has_schema_privilege('anon', 'private', 'usage'), 'anon can resolve private policy helpers');
select ok(not has_schema_privilege('authenticated', 'internal', 'usage'), 'authenticated cannot use internal schema');
select ok(not has_schema_privilege('anon', 'pgmq', 'usage'), 'anon cannot use pgmq schema');
select ok(not has_schema_privilege('authenticated', 'pgmq', 'usage'), 'authenticated cannot use pgmq schema');
select ok(not has_function_privilege('anon', 'public.enqueue_job(text,jsonb,integer)', 'execute'), 'anon cannot enqueue jobs');
select ok(not has_function_privilege('authenticated', 'public.read_jobs(text,integer,integer)', 'execute'), 'authenticated cannot read jobs');
select ok(has_function_privilege('service_role', 'public.enqueue_job(text,jsonb,integer)', 'execute'), 'service role can enqueue jobs');
select ok(has_function_privilege('service_role', 'public.read_jobs(text,integer,integer)', 'execute'), 'service role can read jobs');
select ok(has_function_privilege('service_role', 'public.archive_job(text,bigint)', 'execute'), 'service role can archive jobs');

select is(
  (select count(*)::integer from auth.users where raw_user_meta_data ->> 'seed' = 'foundation'),
  2,
  'deterministic foundation identities are present'
);
select is(
  (select count(*)::integer from auth.users where raw_user_meta_data ->> 'seed' = 'foundation' and encrypted_password is null),
  2,
  'foundation identities have no password'
);
select is(
  (select count(*)::integer
   from auth.users
   where raw_user_meta_data ->> 'seed' = 'foundation'
     and instance_id = '00000000-0000-0000-0000-000000000000'::uuid
     and aud = 'authenticated'
     and role = 'authenticated'
     and raw_app_meta_data = '{}'::jsonb
     and confirmation_token = ''
     and email_change = ''
     and email_change_token_new = ''
     and recovery_token = ''),
  2,
  'foundation identities contain the metadata required by GoTrue'
);

set local role service_role;
select lives_ok(
  $$select public.enqueue_job(
    'media_processing',
    '{"version":1,"jobId":"job-foundation","idempotencyKey":"foundation-1","attempt":0}'::jsonb,
    0
  )$$,
  'service role can enqueue a valid job'
);
reset role;

select is((select count(*)::integer from pgmq.q_media_processing), 1, 'queue contains the enqueued job');
select set_config(
  'iride.test_message_id',
  (select msg_id::text from pgmq.q_media_processing order by msg_id limit 1),
  true
);

set local role service_role;
select lives_ok(
  $$select * from public.read_jobs('media_processing', 300, 1)$$,
  'service role can read a job'
);
select throws_ok(
  $$select public.enqueue_job('unknown', '{"version":1,"jobId":"x","idempotencyKey":"x","attempt":0}'::jsonb, 0)$$,
  '22023',
  null,
  'unknown queues are rejected'
);
select throws_ok(
  $$select * from public.read_jobs('media_processing', 300, 11)$$,
  '22023',
  null,
  'queue batches are bounded'
);
select lives_ok(
  $$select public.archive_job('media_processing', current_setting('iride.test_message_id')::bigint)$$,
  'service role can archive a terminal job'
);
reset role;

select is((select count(*)::integer from pgmq.q_media_processing), 0, 'archived job leaves the active queue');
select is((select count(*)::integer from pgmq.a_media_processing), 1, 'archived job is retained');

select * from finish();
rollback;
