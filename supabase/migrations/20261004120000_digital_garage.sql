alter table public.vehicles
  add column mileage_km integer check (mileage_km between 0 and 10000000),
  add column next_service_km integer check (next_service_km between 0 and 10000000),
  add column next_service_date date;

alter type public.media_purpose add value if not exists 'vehicle_document';
alter table public.media add column garage_vehicle_id uuid references public.vehicles(id) on delete restrict;
alter table public.media add constraint media_document_context check (
  (purpose::text='vehicle_document' and garage_vehicle_id is not null) or
  (purpose::text<>'vehicle_document' and garage_vehicle_id is null)
);

create table public.vehicle_records (
  id uuid primary key default extensions.gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  kind text not null check (kind in ('service','modification')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  occurred_on date not null,
  mileage_km integer check (mileage_km between 0 and 10000000),
  description text check (char_length(description) <= 4000),
  workshop_name text check (char_length(workshop_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, vehicle_id)
);
create index vehicle_records_history_idx on public.vehicle_records(vehicle_id, occurred_on desc, id);
create table public.vehicle_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  record_id uuid,
  filename text not null check (char_length(filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  bytes integer not null check (bytes between 1 and 10485760),
  object_key text unique,
  media_id uuid unique references public.media(id) on delete restrict,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (record_id, vehicle_id) references public.vehicle_records(id, vehicle_id) on delete restrict,
  constraint document_storage_kind check (deleted_at is not null or
    (mime_type='application/pdf' and object_key is not null and media_id is null) or
    (mime_type='image/webp' and object_key is null and media_id is not null))
);
create index vehicle_documents_owner_idx on public.vehicle_documents(owner_id, vehicle_id) where deleted_at is null;
create table public.vehicle_transfers (
  id uuid primary key default extensions.gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  from_id uuid not null references public.profiles(id) on delete restrict,
  to_id uuid not null references public.profiles(id) on delete restrict,
  vehicle_label text not null,
  from_username text not null,
  to_username text not null,
  document_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled','expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (from_id <> to_id)
);
create unique index vehicle_transfers_one_pending_idx on public.vehicle_transfers(vehicle_id) where status = 'pending';
create index vehicle_transfers_participants_idx on public.vehicle_transfers(to_id, from_id, created_at desc);

alter table public.vehicle_records enable row level security;
alter table public.vehicle_documents enable row level security;
alter table public.vehicle_transfers enable row level security;
revoke all on public.vehicle_records, public.vehicle_documents, public.vehicle_transfers from public, anon, authenticated;
grant select, insert, update, delete on public.vehicle_records to authenticated;
grant select on public.vehicle_documents, public.vehicle_transfers to authenticated;
grant all on public.vehicle_records, public.vehicle_documents, public.vehicle_transfers to service_role;
create policy records_owner_select on public.vehicle_records for select to authenticated using
  (exists (select 1 from public.vehicles v where v.id = vehicle_id and v.owner_id = auth.uid()));
create policy records_owner_write on public.vehicle_records for all to authenticated using
  (private.can_write() and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.owner_id = auth.uid() and v.archived_at is null))
  with check (private.can_write() and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.owner_id = auth.uid() and v.archived_at is null));
create policy documents_owner_select on public.vehicle_documents for select to authenticated using (owner_id = auth.uid());
create policy transfers_participant_select on public.vehicle_transfers for select to authenticated using (auth.uid() in (from_id,to_id));

-- All writers (including legacy SECURITY DEFINER RPCs) serialize with transfers.
create function private.guard_garage_mutation() returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid; v public.vehicles;
begin
  if tg_table_name = 'vehicles' then target_id := old.id;
  elsif tg_table_name = 'media' then
    if current_setting('role',true)='authenticated' and old.owner_id<>auth.uid() and not exists(
      select 1 from public.vehicle_media vm join public.vehicle_transfers t on t.vehicle_id=vm.vehicle_id
      where vm.media_id=old.id and t.status='accepted' and t.from_id=old.owner_id and t.to_id=auth.uid() and t.decided_at=transaction_timestamp()
    ) and not exists(
      select 1 from public.vehicle_documents d join public.vehicle_transfers t on t.vehicle_id=d.vehicle_id
      where d.media_id=old.id and d.id=any(t.document_ids) and t.status='accepted' and t.from_id=old.owner_id and t.to_id=auth.uid() and t.decided_at=transaction_timestamp()
    ) then
      raise exception using errcode='42501',message='GARAGE_FORBIDDEN';
    end if;
    for target_id in select vehicle_id from public.vehicle_media where media_id = old.id
      union select vehicle_id from public.vehicle_documents where media_id=old.id and deleted_at is null
      order by vehicle_id loop
      if exists(select 1 from public.vehicle_transfers where vehicle_id = target_id and status = 'pending' and expires_at > now()) then
        raise exception using errcode = '55000', message = 'GARAGE_TRANSFER_PENDING';
      end if;
    end loop;
    if tg_op = 'DELETE' then return old; end if; return new;
  else
    if tg_op = 'DELETE' then target_id := old.vehicle_id; else target_id := new.vehicle_id; end if;
    if tg_op = 'UPDATE' and new.vehicle_id <> old.vehicle_id then raise exception using errcode = '42501', message = 'GARAGE_FORBIDDEN'; end if;
  end if;
  select * into v from public.vehicles where id = target_id for update;
  if v.archived_at is not null then
    if tg_table_name='vehicles' then
      if tg_op='DELETE' then
        raise exception using errcode='55000',message='GARAGE_ARCHIVED';
      elsif tg_op='UPDATE' then
        if new.archived_at is not null or (to_jsonb(new)-'archived_at'-'updated_at') is distinct from (to_jsonb(old)-'archived_at'-'updated_at') then
          raise exception using errcode='55000',message='GARAGE_ARCHIVED';
        end if;
      end if;
    elsif tg_table_name in('vehicle_records','vehicle_media') then
      raise exception using errcode='55000',message='GARAGE_ARCHIVED';
    elsif tg_table_name='vehicle_documents' then
      if tg_op='INSERT' then
        raise exception using errcode='55000',message='GARAGE_ARCHIVED';
      elsif old.owner_id=v.owner_id then
        raise exception using errcode='55000',message='GARAGE_ARCHIVED';
      end if;
    end if;
  end if;
  if current_setting('role',true)='authenticated' and v.owner_id<>auth.uid() then
    if not exists(select 1 from public.vehicle_transfers where vehicle_id=target_id and status='accepted' and from_id=v.owner_id and to_id=auth.uid() and decided_at=transaction_timestamp()) then
      raise exception using errcode='42501',message='GARAGE_FORBIDDEN';
    end if;
  end if;
  if exists(select 1 from public.vehicle_transfers where vehicle_id = target_id and status = 'pending' and expires_at > now()) then
    raise exception using errcode = '55000', message = 'GARAGE_TRANSFER_PENDING';
  end if;
  if tg_table_name='vehicle_media' and tg_op<>'DELETE' then
    -- Lock the photo too: a concurrent recipient acceptance changes its owner.
    perform 1 from public.media where id=new.media_id for update;
    if exists(select 1 from public.media where id=new.media_id and purpose::text='vehicle_document') then
      raise exception using errcode='42501',message='GARAGE_DOCUMENT_PRIVATE';
    end if;
    if current_setting('role',true)='authenticated' and not exists(select 1 from public.media where id=new.media_id and owner_id=auth.uid()) then
      raise exception using errcode='42501',message='GARAGE_FORBIDDEN';
    end if;
    if exists(select 1 from public.vehicle_media vm join public.vehicle_transfers t on t.vehicle_id=vm.vehicle_id where vm.media_id=new.media_id and t.status='pending' and t.expires_at>now()) then
      raise exception using errcode='55000',message='GARAGE_TRANSFER_PENDING';
    end if;
  end if;
  if tg_table_name = 'vehicles' then
    if tg_op = 'UPDATE' and new.owner_id <> old.owner_id then
      if not exists(select 1 from public.vehicle_transfers where vehicle_id = target_id and status = 'accepted' and from_id = old.owner_id and to_id = new.owner_id and decided_at = transaction_timestamp()) then
        raise exception using errcode = '42501', message = 'GARAGE_FORBIDDEN';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.guard_garage_mutation() from public,anon,authenticated,service_role;
create trigger garage_vehicle_guard before update or delete on public.vehicles for each row execute function private.guard_garage_mutation();
create trigger garage_record_guard before insert or update or delete on public.vehicle_records for each row execute function private.guard_garage_mutation();
create trigger garage_document_guard before insert or update or delete on public.vehicle_documents for each row execute function private.guard_garage_mutation();
create trigger garage_photo_guard before insert or update or delete on public.vehicle_media for each row execute function private.guard_garage_mutation();
create trigger garage_media_guard before update or delete on public.media for each row execute function private.guard_garage_mutation();

create function public.create_vehicle_transfer(target_vehicle_id uuid, recipient_username text, selected_document_ids uuid[] default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); recipient uuid; v public.vehicles; result uuid; ids uuid[] := coalesce(selected_document_ids,'{}');
begin
  if actor is null or not private.can_write() then raise exception using errcode='42501', message='GARAGE_FORBIDDEN'; end if;
  select * into v from public.vehicles where id = target_vehicle_id for update;
  if v.id is null or v.owner_id <> actor then raise exception using errcode='42501',message='GARAGE_FORBIDDEN'; end if;
  if v.archived_at is not null then raise exception using errcode='55000',message='GARAGE_ARCHIVED'; end if;
  update public.vehicle_transfers set status='expired',decided_at=now() where vehicle_id=v.id and status='pending' and expires_at <= now();
  if exists(select 1 from public.vehicle_transfers where vehicle_id=v.id and status='pending') then raise exception using errcode='55000',message='GARAGE_TRANSFER_PENDING'; end if;
  select p.id into recipient from public.profiles p join public.account_access a on a.user_id=p.id
    where p.username=lower(btrim(recipient_username)) and a.status='active' and a.transition_id is null;
  if recipient is null or recipient=actor then raise exception using errcode='22023',message='GARAGE_RECIPIENT_INVALID'; end if;
  -- Share prevention uses the same vehicle -> media lock order as acceptance
  -- and photo attachment. A concurrent second attachment either precedes this
  -- recheck or observes the committed pending invitation and is rejected.
  perform m.id from public.media m where m.id in(select media_id from public.vehicle_media where vehicle_id=v.id)
    or m.id in(select media_id from public.vehicle_documents where id=any(ids) and vehicle_id=v.id and deleted_at is null)
    order by m.id for update;
  if cardinality(ids)>100 or cardinality(ids)<>(select count(distinct selected.id) from unnest(ids) as selected(id))
    or exists(select 1 from unnest(ids) as selected(id) where not exists(select 1 from public.vehicle_documents d where d.id=selected.id and d.vehicle_id=v.id and d.owner_id=actor and d.deleted_at is null))
    then raise exception using errcode='22023',message='GARAGE_DOCUMENT_INVALID'; end if;
  -- A photo shared with another resource cannot be safely transferred.
  if exists(select 1 from public.vehicle_media vm join public.media m on m.id=vm.media_id where vm.vehicle_id=v.id and
    (m.owner_id<>actor or m.status<>'ready' or m.deleted_at is not null or
     exists(select 1 from public.vehicle_media other where other.media_id=m.id and other.vehicle_id<>v.id) or
     exists(select 1 from public.profiles p where p.avatar_media_id=m.id or p.cover_media_id=m.id) or
     exists(select 1 from public.trip_recap_entries r where m.id=any(r.media_ids))))
    then raise exception using errcode='55000',message='GARAGE_PHOTO_SHARED'; end if;
  insert into public.vehicle_transfers(vehicle_id,from_id,to_id,vehicle_label,from_username,to_username,document_ids)
    values(v.id,actor,recipient,coalesce(v.nickname,v.brand||' '||v.model),(select username from public.profiles where id=actor),(select username from public.profiles where id=recipient),ids) returning id into result;
  return result;
end $$;

create function public.decide_vehicle_transfer(target_transfer_id uuid, decision text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); transfer public.vehicle_transfers; target_id uuid; v public.vehicles;
begin
  if actor is null or not private.can_write() then raise exception using errcode='42501',message='GARAGE_FORBIDDEN'; end if;
  select vehicle_id into target_id from public.vehicle_transfers where id=target_transfer_id and actor in(from_id,to_id);
  if target_id is null then raise exception using errcode='42501',message='GARAGE_FORBIDDEN'; end if;
  -- Lock ordering is vehicle, then transfer, consistently with every mutation.
  select * into v from public.vehicles where id=target_id for update;
  select * into transfer from public.vehicle_transfers where id=target_transfer_id for update;
  if transfer.status<>'pending' then raise exception using errcode='55000',message='GARAGE_TRANSFER_CLOSED'; end if;
  if decision is null or decision not in('accept','reject','cancel') or (decision in('accept','reject') and actor<>transfer.to_id) or (decision='cancel' and actor<>transfer.from_id)
    then raise exception using errcode='42501',message='GARAGE_FORBIDDEN'; end if;
  if transfer.expires_at<=now() then
    update public.vehicle_transfers set status='expired',decided_at=now() where id=transfer.id;
    return transfer.id;
  end if;
  if v.owner_id<>transfer.from_id then raise exception using errcode='55000',message='GARAGE_TRANSFER_CLOSED'; end if;
  if decision='accept' then
    if not exists(select 1 from public.account_access where user_id=transfer.from_id and status='active' and transition_id is null)
      then raise exception using errcode='42501',message='GARAGE_FORBIDDEN'; end if;
    -- Closing pending status unlocks the guarded writes in this same transaction.
    update public.vehicle_transfers set status='accepted',decided_at=now() where id=transfer.id;
    update public.media set owner_id=transfer.to_id where id in(select media_id from public.vehicle_media where vehicle_id=v.id);
    update public.media set owner_id=transfer.to_id where id in(select media_id from public.vehicle_documents where vehicle_id=v.id and id=any(transfer.document_ids) and owner_id=transfer.from_id and deleted_at is null);
    update public.vehicle_documents set owner_id=transfer.to_id where vehicle_id=v.id and id=any(transfer.document_ids) and owner_id=transfer.from_id and deleted_at is null;
    update public.vehicle_documents set record_id=null where vehicle_id=v.id and owner_id<>transfer.to_id;
    update public.vehicles set owner_id=transfer.to_id,visibility='private',archived_at=null,updated_at=now() where id=v.id;
  else
    update public.vehicle_transfers set status=case decision when 'reject' then 'rejected' else 'cancelled' end,decided_at=now() where id=transfer.id;
  end if;
  return transfer.id;
end $$;
revoke all on function public.create_vehicle_transfer(uuid,text,uuid[]),public.decide_vehicle_transfer(uuid,text) from public,anon,service_role;
grant execute on function public.create_vehicle_transfer(uuid,text,uuid[]),public.decide_vehicle_transfer(uuid,text) to authenticated;

create function public.delete_garage_record(target_vehicle_id uuid,target_record_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v public.vehicles;
begin
  if not private.can_write() then raise exception using errcode='42501',message='GARAGE_FORBIDDEN'; end if;
  select * into v from public.vehicles where id=target_vehicle_id for update;
  if v.id is null or v.owner_id<>auth.uid() then raise exception using errcode='42501',message='GARAGE_FORBIDDEN'; end if;
  if v.archived_at is not null then raise exception using errcode='55000',message='GARAGE_ARCHIVED'; end if;
  if not exists(select 1 from public.vehicle_records where id=target_record_id and vehicle_id=v.id) then raise exception using errcode='22023',message='GARAGE_NOT_FOUND'; end if;
  update public.vehicle_documents set record_id=null where record_id=target_record_id;
  delete from public.vehicle_records where id=target_record_id;
end $$;
revoke all on function public.delete_garage_record(uuid,uuid) from public,anon,service_role;
grant execute on function public.delete_garage_record(uuid,uuid) to authenticated;

-- Documents are uploaded and downloaded through the authenticated API only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('garage-documents','garage-documents',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function public.assert_garage_document_upload(target_vehicle_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v public.vehicles;
begin
  if auth.uid() is null or not private.can_write() then raise exception using errcode='42501',message='GARAGE_FORBIDDEN'; end if;
  select * into v from public.vehicles where id=target_vehicle_id for update;
  if v.id is null or v.owner_id<>auth.uid() then raise exception using errcode='42501',message='GARAGE_FORBIDDEN'; end if;
  if v.archived_at is not null then raise exception using errcode='55000',message='GARAGE_ARCHIVED'; end if;
  if exists(select 1 from public.vehicle_transfers where vehicle_id=v.id and status='pending' and expires_at>now()) then raise exception using errcode='55000',message='GARAGE_TRANSFER_PENDING'; end if;
end $$;
revoke all on function public.assert_garage_document_upload(uuid) from public,anon,service_role;
grant execute on function public.assert_garage_document_upload(uuid) to authenticated;

create function private.guard_document_media_upload() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.purpose::text='vehicle_document' and current_setting('role',true)='authenticated' then
    perform public.assert_garage_document_upload(new.garage_vehicle_id);
  end if;
  return new;
end $$;
revoke all on function private.guard_document_media_upload() from public,anon,authenticated,service_role;
create trigger garage_document_media_insert_guard before insert on public.media for each row execute function private.guard_document_media_upload();

create function public.attach_garage_image_document(target_vehicle_id uuid,processed_media_id uuid,target_record_id uuid,document_filename text) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.media; preview public.media_variants; result uuid;
begin
  perform public.assert_garage_document_upload(target_vehicle_id);
  select * into m from public.media where id=processed_media_id for update;
  if m.id is null or m.owner_id<>auth.uid() or m.purpose::text<>'vehicle_document' or m.garage_vehicle_id<>target_vehicle_id or m.status<>'ready' or m.deleted_at is not null or m.storage_provider<>'supabase' or m.mime_type not in('image/jpeg','image/png','image/webp') or m.bytes not between 1 and 10485760
    then raise exception using errcode='42501',message='GARAGE_DOCUMENT_MEDIA_FORBIDDEN'; end if;
  if exists(select 1 from public.vehicle_documents where media_id=m.id) then raise exception using errcode='55000',message='GARAGE_DOCUMENT_ALREADY_ATTACHED'; end if;
  if target_record_id is not null and not exists(select 1 from public.vehicle_records where id=target_record_id and vehicle_id=target_vehicle_id) then raise exception using errcode='22023',message='GARAGE_RECORD_NOT_FOUND'; end if;
  if document_filename is null or char_length(btrim(document_filename)) not between 1 and 255 or document_filename ~ '[[:cntrl:]/\\]' then raise exception using errcode='22023',message='GARAGE_DOCUMENT_INVALID'; end if;
  select * into preview from public.media_variants where media_id=m.id and kind='preview';
  if preview.id is null or preview.mime_type<>'image/webp' or preview.bytes not between 1 and 10485760 or preview.width<=0 or preview.height<=0 then raise exception using errcode='42501',message='GARAGE_DOCUMENT_MEDIA_FORBIDDEN'; end if;
  insert into public.vehicle_documents(vehicle_id,owner_id,record_id,filename,mime_type,bytes,media_id)
  values(target_vehicle_id,auth.uid(),target_record_id,document_filename,'image/webp',preview.bytes,m.id) returning id into result;
  return result;
end $$;
revoke all on function public.attach_garage_image_document(uuid,uuid,uuid,text) from public,anon,service_role;
grant execute on function public.attach_garage_image_document(uuid,uuid,uuid,text) to authenticated;
