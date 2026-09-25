alter table public.events
  add column trip_status text not null default 'planned',
  add column completed_at timestamptz,
  add constraint events_trip_status_valid check (
    (kind = 'trip' and trip_status in ('planned', 'completed'))
    or (kind <> 'trip' and trip_status = 'planned' and completed_at is null)
  ),
  add constraint events_completed_at_valid check (
    (trip_status = 'completed' and completed_at is not null)
    or (trip_status = 'planned' and completed_at is null)
  );

create table public.trip_participations (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('interested', 'going')),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  riding_area text check (riding_area is null or char_length(btrim(riding_area)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create trigger set_trip_participations_updated_at before update on public.trip_participations
  for each row execute function public.set_updated_at();
create index trip_participations_user_idx on public.trip_participations(user_id);

create table public.trip_announcements (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index trip_announcements_event_idx on public.trip_announcements(event_id, created_at desc);

create table public.trip_recaps (
  event_id uuid primary key references public.events(id) on delete cascade,
  summary text not null default '' check (char_length(summary) <= 4000),
  route_points jsonb not null default '[]'::jsonb check (private.valid_trip_stops(route_points)),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger set_trip_recaps_updated_at before update on public.trip_recaps
  for each row execute function public.set_updated_at();

create table public.trip_recap_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  stop_name text check (stop_name is null or char_length(btrim(stop_name)) between 1 and 160),
  review text not null default '' check (char_length(review) <= 2000),
  media_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint trip_recap_entries_content check (char_length(btrim(review)) > 0 or cardinality(media_ids) > 0),
  constraint trip_recap_entries_media_count check (cardinality(media_ids) <= 8)
);
create index trip_recap_entries_event_idx on public.trip_recap_entries(event_id, created_at);

create function private.valid_recap_media(owner uuid, ids uuid[])
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from unnest(ids) candidate(id)
    left join public.media m on m.id = candidate.id
    where m.id is null or m.owner_id <> owner or m.purpose <> 'trip_recap'::public.media_purpose
      or m.status <> 'ready' or m.deleted_at is not null
  ) and cardinality(ids) = (select count(distinct id) from unnest(ids) candidate(id));
$$;
revoke all on function private.valid_recap_media(uuid, uuid[]) from public, anon;
grant execute on function private.valid_recap_media(uuid, uuid[]) to authenticated, service_role;

alter table public.trip_participations enable row level security;
alter table public.trip_announcements enable row level security;
alter table public.trip_recaps enable row level security;
alter table public.trip_recap_entries enable row level security;
revoke all on public.trip_participations, public.trip_announcements, public.trip_recaps, public.trip_recap_entries from public, anon, authenticated;
grant select on public.trip_participations, public.trip_announcements, public.trip_recaps, public.trip_recap_entries to anon;
grant select, insert, update, delete on public.trip_participations, public.trip_announcements, public.trip_recaps, public.trip_recap_entries to authenticated;
grant all on public.trip_participations, public.trip_announcements, public.trip_recaps, public.trip_recap_entries to service_role;

create policy trip_participations_read on public.trip_participations for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = event_id and e.deleted_at is null and e.kind = 'trip'));
create policy trip_participations_insert on public.trip_participations for insert to authenticated
with check (
  user_id = (select auth.uid()) and private.can_write()
  and exists (select 1 from public.events e where e.id = event_id and e.kind = 'trip' and e.deleted_at is null and e.trip_status = 'planned')
  and (vehicle_id is null or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.owner_id = (select auth.uid()) and v.visibility = 'public' and v.archived_at is null))
);
create policy trip_participations_update on public.trip_participations for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid()) and private.can_write()
  and exists (select 1 from public.events e where e.id = event_id and e.trip_status = 'planned' and e.deleted_at is null)
  and (vehicle_id is null or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.owner_id = (select auth.uid()) and v.visibility = 'public' and v.archived_at is null))
);
create policy trip_participations_delete on public.trip_participations for delete to authenticated
using (user_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id and e.trip_status = 'planned'));

create policy trip_announcements_read on public.trip_announcements for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = event_id and e.deleted_at is null));
create policy trip_announcements_insert on public.trip_announcements for insert to authenticated
with check (author_id = (select auth.uid()) and private.can_write()
  and exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid()) and e.kind = 'trip' and e.deleted_at is null));

create policy trip_recaps_read on public.trip_recaps for select to anon, authenticated
using (exists (select 1 from public.events e where e.id = event_id and e.deleted_at is null
  and (published_at is not null or e.organizer_id = (select auth.uid()))));
create policy trip_recaps_insert on public.trip_recaps for insert to authenticated
with check (private.can_write() and exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid()) and e.kind = 'trip' and e.trip_status = 'completed' and e.deleted_at is null));
create policy trip_recaps_update on public.trip_recaps for update to authenticated
using (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid())))
with check (private.can_write() and exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid()) and e.trip_status = 'completed' and e.deleted_at is null));

create policy trip_recap_entries_read on public.trip_recap_entries for select to anon, authenticated
using (author_id = (select auth.uid()) or exists (
  select 1 from public.events e left join public.trip_recaps r on r.event_id = e.id
  where e.id = event_id and e.deleted_at is null and (e.organizer_id = (select auth.uid()) or r.published_at is not null)
));
create policy trip_recap_entries_insert on public.trip_recap_entries for insert to authenticated
with check (
  author_id = (select auth.uid()) and private.can_write() and private.valid_recap_media(author_id, media_ids)
  and exists (select 1 from public.events e where e.id = event_id and e.kind = 'trip' and e.trip_status = 'completed' and e.deleted_at is null
    and (e.organizer_id = (select auth.uid()) or exists (
      select 1 from public.trip_participations p where p.event_id = e.id and p.user_id = (select auth.uid()) and p.status = 'going'
    )))
  and not exists (select 1 from public.trip_recaps r where r.event_id = event_id and r.published_at is not null)
);
create policy trip_recap_entries_delete on public.trip_recap_entries for delete to authenticated
using (author_id = (select auth.uid()) or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid())));
