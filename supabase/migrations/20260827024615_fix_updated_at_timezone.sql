create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Shared trigger helper for tables with an updated_at timestamptz column.';

revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;
