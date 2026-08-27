# Step 11 - Places and PostGIS

Status: `not_started`
Dependencies: [Step 02](./02-supabase-foundation.md), [Step 09](./09-posts.md)

## Goal

ทำ place domain และ nearby discovery ด้วย PostGIS พร้อมเชื่อม location เข้ากับ posts

## Architecture Decisions

พิกัดเก็บ `geography(Point,4326)` พร้อม GiST index; category เป็น controlled enum/table และ place creation เข้า moderation state

## Deliverables

- [ ] places, post-place relation, saves และ moderation migrations/RLS
- [ ] nearby/list/detail/create/update APIs
- [ ] categories, slug policy และ distance-aware DTO

## Data/API Contracts

`places(id,name,slug,category,description,location,country_code,province,district,created_by,status,timestamps)`; `GET /places`, `/places/nearby?lat&lng&radius&cursor`, `/places/:slug`

## Implementation Tasks

- [ ] validate coordinate/radius bounds และ SRID
- [ ] nearby query ใช้ `ST_DWithin`, stable cursor และ spatial index
- [ ] เชื่อม place กับ post/check-in และ recent/popular queries
- [ ] moderation `pending|approved|rejected|archived` และ save-place

## Security

จำกัด exact coordinates สำหรับ unsafe/private places; owner ไม่มีสิทธิ์ approve เองและ user input ไม่ประกอบ raw SQL

## Test Plan

- [ ] PostGIS distance/boundary/index tests
- [ ] RLS/moderation/API validation tests
- [ ] posts-at-place integration tests

## Acceptance Criteria

- [ ] nearby results เรียง/กรองถูกต้องและใช้ spatial index
- [ ] เฉพาะ approved places ปรากฏ public
- [ ] post tag/check-in แสดง place DTO ได้

## Out of Scope

Map rendering, route planner และ real-time location

## Handoff to Next Step

ส่ง geo endpoints ให้ [Step 12](./12-explore-map.md)
