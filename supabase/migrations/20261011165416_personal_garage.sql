create table public.garage_vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  brand text, model text, year integer check (year between 1900 and 2100), plate text,
  mileage_km integer check (mileage_km between 0 and 10000000),
  cover_photo_id uuid, deleting boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.garage_service_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.garage_vehicles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  occurred_on date not null, mileage_km integer check (mileage_km between 0 and 10000000),
  workshop text, cost numeric(12,2) check (cost between 0 and 100000000), notes text,
  created_at timestamptz not null default now()
);
create index garage_service_records_vehicle_date on public.garage_service_records(vehicle_id, occurred_on desc, created_at desc, id desc);
create table public.garage_vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.garage_vehicles(id) on delete restrict,
  drive_file_id text unique, name text not null, mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  bytes integer not null check (bytes between 1 and 4000000),
  status text not null default 'uploading' check (status in ('uploading','ready')),
  created_at timestamptz not null default now(),
  constraint ready_photo_has_file check (status <> 'ready' or drive_file_id is not null),
  unique (id, vehicle_id)
);
create index garage_vehicle_photos_vehicle on public.garage_vehicle_photos(vehicle_id, created_at, id);
alter table public.garage_vehicles add constraint cover_belongs_to_vehicle foreign key (cover_photo_id,id)
  references public.garage_vehicle_photos(id,vehicle_id) on delete set null (cover_photo_id);

alter table public.garage_vehicles enable row level security;
alter table public.garage_service_records enable row level security;
alter table public.garage_vehicle_photos enable row level security;
revoke all on public.garage_vehicles, public.garage_service_records, public.garage_vehicle_photos from anon, authenticated;
grant select, insert, update, delete on public.garage_vehicles, public.garage_service_records, public.garage_vehicle_photos to service_role;

-- Locking the vehicle row prevents deletion racing an in-flight upload.
create function public.reserve_vehicle_photo(p_vehicle_id uuid, p_name text, p_mime text, p_bytes integer)
returns public.garage_vehicle_photos language plpgsql security invoker set search_path = '' as $$
declare v public.garage_vehicles; p public.garage_vehicle_photos;
begin
  select * into v from public.garage_vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  if v.deleting then raise exception 'VEHICLE_DELETING'; end if;
  insert into public.garage_vehicle_photos(vehicle_id,name,mime_type,bytes) values(p_vehicle_id,p_name,p_mime,p_bytes) returning * into p;
  return p;
end $$;
create function public.finish_vehicle_photo(p_photo_id uuid, p_file_id text)
returns public.garage_vehicle_photos language plpgsql security invoker set search_path = '' as $$
declare p public.garage_vehicle_photos;
begin
  select * into p from public.garage_vehicle_photos where id = p_photo_id;
  if not found then raise exception 'PHOTO_NOT_FOUND'; end if;
  perform 1 from public.garage_vehicles where id = p.vehicle_id for update;
  update public.garage_vehicle_photos set drive_file_id=p_file_id,status='ready' where id=p_photo_id returning * into p;
  update public.garage_vehicles set cover_photo_id=p.id where id=p.vehicle_id and cover_photo_id is null;
  return p;
end $$;
create function public.remove_vehicle_photo(p_photo_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
declare p public.garage_vehicle_photos;
begin
  select * into p from public.garage_vehicle_photos where id=p_photo_id;
  if not found then return; end if;
  perform 1 from public.garage_vehicles where id=p.vehicle_id for update;
  update public.garage_vehicles set cover_photo_id=(select id from public.garage_vehicle_photos where vehicle_id=p.vehicle_id and status='ready' and id<>p.id order by created_at,id limit 1)
    where id=p.vehicle_id and cover_photo_id=p.id;
  delete from public.garage_vehicle_photos where id=p.id;
end $$;
create function public.begin_vehicle_delete(p_vehicle_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.garage_vehicles where id=p_vehicle_id for update;
  if not found then raise exception 'VEHICLE_NOT_FOUND'; end if;
  if exists(select 1 from public.garage_vehicle_photos where vehicle_id=p_vehicle_id and status='uploading') then raise exception 'UPLOAD_IN_PROGRESS'; end if;
  update public.garage_vehicles set deleting=true where id=p_vehicle_id;
end $$;
revoke execute on function public.reserve_vehicle_photo(uuid,text,text,integer), public.finish_vehicle_photo(uuid,text), public.remove_vehicle_photo(uuid), public.begin_vehicle_delete(uuid) from public, anon, authenticated;
grant execute on function public.reserve_vehicle_photo(uuid,text,text,integer), public.finish_vehicle_photo(uuid,text), public.remove_vehicle_photo(uuid), public.begin_vehicle_delete(uuid) to service_role;

create function public.vehicle_service_total(p_vehicle_id uuid) returns numeric language sql stable security invoker set search_path='' as $$
  select coalesce(sum(cost),0) from public.garage_service_records where vehicle_id=p_vehicle_id
$$;
revoke execute on function public.vehicle_service_total(uuid) from public, anon, authenticated;
grant execute on function public.vehicle_service_total(uuid) to service_role;

-- Earlier v1 deployments stay blocked; v2 reads only the isolated Garage tables.
create function public.garage_schema_version() returns text language sql immutable security invoker set search_path='' as $$ select 'personal-garage-v2'::text $$;
revoke execute on function public.garage_schema_version() from public, anon, authenticated;
grant execute on function public.garage_schema_version() to service_role;
