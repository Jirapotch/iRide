# Step 16 - Photo Albums

Status: `not_started`
Dependencies: [Step 13](./13-events.md), [Step 15](./15-photographer-profile.md)

## Goal

ให้ photographer สร้าง draft/published album เชื่อม event/place พร้อม pricing configuration

## Architecture Decisions

album publish ได้เมื่อมี ready cover/photo; photos อ้าง central media และ price เก็บ integer satang/THB รูปหนึ่งขายซ้ำได้จึงไม่มี `is_purchased`

## Deliverables

- [ ] photo_albums/photos migrations, RLS และ publish state machine
- [ ] album/photo CRUD, cover, event/place links และ pricing APIs
- [ ] dashboard/editor/public album shell

## Data/API Contracts

`photo_albums(id,photographer_id,event_id,place_id,title,description,cover_media_id,shot_at,visibility,status,timestamps)`; `photos(id,album_id,media_id,photographer_id,price,currency,sale_status,timestamps)`

## Implementation Tasks

- [ ] validate photographer ownership, link visibility และ THB price bounds
- [ ] draft/publish/unpublish transitions และ stable photo ordering
- [ ] bulk pricing mutation แบบ transaction
- [ ] public DTO แสดงเฉพาะ published/ready inventory

## Security

ห้ามคืน original object key; photographer แก้เฉพาะ album/photos ของตนและ purchased references ไม่ถูก hard delete

## Test Plan

- [ ] schema/RLS/state transition tests
- [ ] pricing/publish/link API tests
- [ ] Playwright create/edit/publish album shell

## Acceptance Criteria

- [ ] photographer สร้าง album เชื่อม event/place และกำหนดราคาได้
- [ ] invalid/draft album ไม่ปรากฏ marketplace
- [ ] model รองรับขาย photo ซ้ำหลาย order

## Out of Scope

Bulk bytes upload, previews, cart และ checkout

## Handoff to Next Step

ส่ง album/photo draft contracts ให้ [Step 17](./17-bulk-upload.md)
