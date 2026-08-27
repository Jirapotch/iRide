create schema if not exists extensions;
create schema if not exists private;
create schema if not exists internal;

revoke all on schema private from public, anon, authenticated;
revoke all on schema internal from public, anon, authenticated;
grant usage on schema private, internal to service_role;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgtap with schema extensions;
create extension if not exists pgmq;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Shared trigger helper for tables with an updated_at timestamptz column.';

revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;

select pgmq.create('media_processing');

alter table pgmq.q_media_processing enable row level security;
alter table pgmq.a_media_processing enable row level security;

revoke all on schema pgmq from public, anon, authenticated, service_role;
revoke all on all tables in schema pgmq from public, anon, authenticated, service_role;
revoke all on all sequences in schema pgmq from public, anon, authenticated, service_role;
revoke all on all functions in schema pgmq from public, anon, authenticated, service_role;

create or replace function private.assert_known_queue(queue_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if queue_name is distinct from 'media_processing' then
    raise exception 'Unknown queue: %', coalesce(queue_name, '<null>')
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.assert_job_message(message jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(message) is distinct from 'object'
    or not message ?& array['version', 'jobId', 'idempotencyKey', 'attempt']
    or jsonb_typeof(message -> 'version') is distinct from 'number'
    or jsonb_typeof(message -> 'jobId') is distinct from 'string'
    or nullif(message ->> 'jobId', '') is null
    or jsonb_typeof(message -> 'idempotencyKey') is distinct from 'string'
    or nullif(message ->> 'idempotencyKey', '') is null
    or jsonb_typeof(message -> 'attempt') is distinct from 'number'
    or (message ->> 'attempt')::numeric < 0
    or trunc((message ->> 'attempt')::numeric) <> (message ->> 'attempt')::numeric
  then
    raise exception 'Queue messages require version, jobId, idempotencyKey, and a non-negative integer attempt'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.assert_known_queue(text) from public, anon, authenticated, service_role;
revoke all on function private.assert_job_message(jsonb) from public, anon, authenticated, service_role;

create or replace function public.enqueue_job(
  queue_name text,
  message jsonb,
  delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_id bigint;
begin
  perform private.assert_known_queue(queue_name);
  perform private.assert_job_message(message);

  if delay_seconds is null or delay_seconds < 0 or delay_seconds > 86400 then
    raise exception 'delay_seconds must be between 0 and 86400'
      using errcode = '22023';
  end if;

  select result.msg_id
    into strict message_id
  from pgmq.send(
    queue_name => queue_name,
    msg => message,
    delay => delay_seconds
  ) as result(msg_id)
  limit 1;

  return message_id;
end;
$$;

create or replace function public.read_jobs(
  queue_name text,
  visibility_timeout_seconds integer default 300,
  batch_size integer default 1
)
returns table (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  last_read_at timestamptz,
  vt timestamptz,
  message jsonb,
  headers jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_known_queue(queue_name);

  if visibility_timeout_seconds is null
    or visibility_timeout_seconds < 1
    or visibility_timeout_seconds > 900
  then
    raise exception 'visibility_timeout_seconds must be between 1 and 900'
      using errcode = '22023';
  end if;

  if batch_size is null or batch_size < 1 or batch_size > 10 then
    raise exception 'batch_size must be between 1 and 10'
      using errcode = '22023';
  end if;

  return query
  select queued.msg_id,
         queued.read_ct,
         queued.enqueued_at,
         queued.last_read_at,
         queued.vt,
         queued.message,
         queued.headers
  from pgmq.read(
    queue_name => queue_name,
    vt => visibility_timeout_seconds,
    qty => batch_size
  ) as queued;
end;
$$;

create or replace function public.archive_job(queue_name text, message_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_known_queue(queue_name);

  if message_id is null or message_id < 1 then
    raise exception 'message_id must be a positive integer'
      using errcode = '22023';
  end if;

  return pgmq.archive(queue_name => queue_name, msg_id => message_id);
end;
$$;

comment on function public.enqueue_job(text, jsonb, integer) is
  'Trusted-service entrypoint for versioned durable jobs.';
comment on function public.read_jobs(text, integer, integer) is
  'Trusted-service queue read with bounded visibility and batch size.';
comment on function public.archive_job(text, bigint) is
  'Trusted-service terminal archive operation.';

revoke all on function public.enqueue_job(text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.read_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.archive_job(text, bigint) from public, anon, authenticated;

grant usage on schema public to service_role;
grant execute on function public.enqueue_job(text, jsonb, integer) to service_role;
grant execute on function public.read_jobs(text, integer, integer) to service_role;
grant execute on function public.archive_job(text, bigint) to service_role;

alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke all on sequences from public, anon, authenticated;
alter default privileges in schema private revoke all on functions from public, anon, authenticated;
alter default privileges in schema internal revoke all on tables from public, anon, authenticated;
alter default privileges in schema internal revoke all on sequences from public, anon, authenticated;
alter default privileges in schema internal revoke all on functions from public, anon, authenticated;
