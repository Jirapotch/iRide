# Step 08 - Garage

Status: `not_started`
Dependencies: [Step 04](./04-profiles.md), [Step 07](./07-image-worker.md)

## Goal

ให้ผู้ใช้สร้างและจัดการ vehicle identity พร้อม gallery และ visibility

## Architecture Decisions

ใช้ `vehicles` ตารางเดียวสำหรับ `car|motorcycle|bicycle|kart|boat|other`; รูปเชื่อมผ่าน `vehicle_media` และ archive แทน hard delete เมื่อมี references

## Deliverables

- [ ] vehicles/vehicle_media migrations, indexes และ RLS
- [ ] CRUD API, garage/detail pages และ mobile forms `th/en`
- [ ] cover/gallery ordering, media attach validation และ profile-to-garage navigation

## Data/API Contracts

`vehicles(id, owner_id, type, brand, model, variant, year, nickname, description, visibility, archived_at, timestamps)`; `GET /users/:username/garage`, `POST /vehicles`, `GET/PATCH/DELETE /vehicles/:id`

## Implementation Tasks

- [ ] validate year/type/visibility และ owner media
- [ ] transactionally reorder gallery และ enforce one cover
- [ ] public reads เคารพ profile/vehicle visibility
- [ ] archive vehicle เมื่อถูก post/event อ้างอิง

## Security

owner-only mutations; ห้าม attach media ของผู้อื่นหรือ expose private garage ผ่าน nested endpoints

## Test Plan

- [ ] migration/RLS and API CRUD/ownership tests
- [ ] gallery ordering/archive reference tests
- [ ] Playwright add/edit/view garage บน mobile ทั้งสอง locale

## Acceptance Criteria

- [ ] owner จัดการ vehicle/gallery ได้และ public visibility ถูกต้อง
- [ ] archived vehicle ไม่หายจาก historical references
- [ ] ไม่มี raw media URL ใน domain rows

## Out of Scope

Vehicle catalog, VIN lookup, marketplace และ modifications database

## Handoff to Next Step

ส่ง vehicle tag contract ให้ [Step 09](./09-posts.md)
