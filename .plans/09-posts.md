# Step 09 - Posts

Status: `not_started`
Dependencies: [Step 07](./07-image-worker.md), [Step 08](./08-garage.md)

## Goal

สร้าง post lifecycle ที่รองรับข้อความ, media หลายรูป, vehicle tags, comments, reactions, saves และ follows

## Architecture Decisions

Post types `post|announcement|checkin|event_share`; soft delete, cursor-ready timestamps และ authorization server-side ทุก mutation

## Deliverables

- [ ] posts, post_media, post_vehicles, comments, reactions, saves, follows migrations/RLS
- [ ] create/read/edit/delete post APIs และ interaction endpoints
- [ ] mobile composer/detail/carousel พร้อม optimistic UI ที่ rollback ได้

## Data/API Contracts

`POST /api/v1/posts`, `GET/PATCH/DELETE /api/v1/posts/:id`, reactions/comments/save/follow endpoints; response ใช้ stable DTO ไม่คืน private object keys

## Implementation Tasks

- [ ] validate body/media limits, ready media ownership และ visible vehicle tags
- [ ] idempotent reaction/save/follow constraints
- [ ] nested comment policy ระดับเดียวผ่าน nullable `parent_id`
- [ ] edit/delete permissions และ soft-delete presentation

## Security

RLS ป้องกัน cross-owner mutation; sanitize/render plain text safely, rate-limit writes และ filter hidden content

## Test Plan

- [ ] database constraints/RLS tests
- [ ] API CRUD, duplicate interaction, cursor seed และ permission tests
- [ ] Playwright create/edit/delete/interact ทั้ง `th/en`

## Acceptance Criteria

- [ ] ผู้ใช้ post พร้อมรูป/vehicle tag และ interact ได้
- [ ] permissions, soft delete และ unique interactions ถูกต้อง
- [ ] API DTO พร้อมใช้ใน feed โดยไม่รั่ว private media

## Out of Scope

Ranking, places/events/community linkage และ realtime chat

## Handoff to Next Step

ส่ง post DTO/query primitives ให้ [Step 10](./10-feed.md)
