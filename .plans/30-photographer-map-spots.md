# Step 30 - Photographer Map Spots

Status: `not_started`
Dependencies: [Step 15](./15-photographer-profile.md), [Step 18](./18-watermarked-previews.md), [Step 29](./29-photographer-storage-plans.md)

## Goal

เพิ่ม photographer layer บน Explore Map สำหรับ recurring, scheduled, event และ historical shooting spots

## Architecture Decisions

ตำแหน่งแสดงเฉพาะ explicit published schedule/status; ห้าม infer real-time presence และ unsafe/private coordinates ต้องผ่าน moderation

## Deliverables

- [ ] photographer_spots/schedules/media migrations, RLS และ moderation
- [ ] photographer spot CRUD, schedule/status และ album linkage APIs
- [ ] map layer/filter/marker sheet พร้อม profile/albums navigation

## Data/API Contracts

types `recurring|scheduled|event|historical`; public status คำนวณ `active_today|scheduled|historical` จาก timezone/schedule; Geo DTO ไม่รวม private notes

## Implementation Tasks

- [ ] validate schedule overlap/timezone/visibility
- [ ] link examples/ready albums/photos และ MapTiler viewport query
- [ ] reporting, archive และ safety location review
- [ ] label scheduled vs historical ให้ไม่สื่อว่ากำลังอยู่จริง

## Security

owner/admin mutations, precise sensitive location redaction และ report workflow ก่อน republish

## Test Plan

- [ ] timezone/recurrence/status/RLS tests
- [ ] map bounds/filter/album linkage tests
- [ ] Playwright photographer layer/mobile sheet `th/en`

## Acceptance Criteria

- [ ] map แยก active/scheduled/historical ชัดเจน
- [ ] spots เชื่อม photographer/examples/albums โดยไม่มี original leakage
- [ ] ไม่มี implicit real-time tracking หรือ unsafe location exposure

## Out of Scope

Live GPS tracking, route planner และ automatic location inference

## Handoff to Next Step

ส่ง reusable business-map patterns ให้ [Step 31](./31-business-parts-discovery.md)
