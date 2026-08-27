# Step 10 - Feed

Status: `not_started`
Dependencies: [Step 09](./09-posts.md)

## Goal

ส่ง chronological feed ที่เร็วและต่อเนื่อง พร้อม following filter และ cursor pagination

## Architecture Decisions

MVP ใช้ reverse chronological ranking เท่านั้น; opaque cursor จาก `(published_at,id)`, stable page size และ thumbnail-first media

## Deliverables

- [ ] `GET /api/v1/feed?scope=all|following&cursor=&limit=`
- [ ] optimized query/indexes และ stable feed DTO
- [ ] infinite-scroll mobile UI, loading/empty/error/retry และ scroll restoration
- [ ] feed observability สำหรับ latency/query count

## Data/API Contracts

response `{ items, nextCursor }`; item รวม author, counts, viewer interaction flags, ordered media/vehicle tags โดยไม่รวม original URL

## Implementation Tasks

- [ ] query ลด N+1 และเคารพ visibility/deleted/blocked-ready hooks
- [ ] encode/decode cursor แบบ versioned และ reject malformed cursor
- [ ] prefetch thumbnail เท่าที่จำเป็นและ lazy-load remainder
- [ ] localized timestamps/accessibility labels

## Security

ทุก row ต้องผ่าน visibility policy; cursor ห้ามเป็น SQL fragment และ cache ต้องแยกตาม viewer

## Test Plan

- [ ] pagination ไม่มี duplicate/gap เมื่อ timestamp เท่ากัน
- [ ] all/following visibility และ deleted-content integration tests
- [ ] Playwright infinite scroll/retry/mobile performance smoke

## Acceptance Criteria

- [ ] feed ต่อหน้า deterministic และ interaction state ถูกต้อง
- [ ] ไม่มี N+1 ที่เกิน query budget ที่กำหนดใน test
- [ ] Community feed foundation ใช้งานได้สองภาษา

## Out of Scope

AI/personalized ranking, recommendations และ promoted content

## Handoff to Next Step

ส่ง post/feed integration hooks ให้ [Step 11](./11-places-postgis.md)
