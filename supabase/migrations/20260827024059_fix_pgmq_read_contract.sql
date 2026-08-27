drop function public.read_jobs(text, integer, integer);

create function public.read_jobs(
  queue_name text,
  visibility_timeout_seconds integer default 300,
  batch_size integer default 1
)
returns table (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
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

comment on function public.read_jobs(text, integer, integer) is
  'Trusted-service queue read with bounded visibility and batch size. Compatible with Supabase pgmq 1.5.1.';

revoke all on function public.read_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.read_jobs(text, integer, integer) to service_role;
