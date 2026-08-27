# Step 13 - Events

Status: `not_started`
Dependencies: [Step 08](./08-garage.md), [Step 11](./11-places-postgis.md)

## Goal

ให้ผู้ใช้สร้าง ค้นพบ และเข้าร่วม event พร้อมเลือก vehicle และเชื่อม feed/map

## Architecture Decisions

event times เก็บ UTC พร้อม timezone identifier; attendee unique ต่อ event/profile และ status `interested|going|attended|cancelled`

## Deliverables

- [ ] events/event_attendees migrations, RLS และ indexes
- [ ] create/list/detail/update/join APIs และ mobile pages
- [ ] place, cover media, vehicle selection, counts, feed share และ map integration

## Data/API Contracts

`events(id,organizer_id,community_id,title,description,cover_media_id,place_id,starts_at,ends_at,timezone,capacity,status,visibility,timestamps)`; `/events`, `/events/:id`, `/events/:id/join`

## Implementation Tasks

- [ ] validate dates/capacity/status transitions
- [ ] join/update attendance transactionally และ enforce visible owned vehicle
- [ ] upcoming query/index และ attendee counts ไม่ drift
- [ ] create event-share post และ expose map summary

## Security

organizer/admin-only edits; private attendee list/vehicle selection จำกัด audience และ capacity race ป้องกันใน database transaction

## Test Plan

- [ ] date/capacity/concurrent join/RLS tests
- [ ] API lifecycle/event-share tests
- [ ] Playwright create/discover/join with vehicle ทั้งสอง locale

## Acceptance Criteria

- [ ] event แสดงใน detail/feed/map และ join status ถูกต้อง
- [ ] capacity/permissions/timezone ผ่าน edge cases
- [ ] event historical data คงอยู่เมื่อ vehicle archived

## Out of Scope

Ticketing, payment, QR check-in และ recurring events

## Handoff to Next Step

ส่ง organizer/event contracts ให้ [Step 14](./14-communities.md)
