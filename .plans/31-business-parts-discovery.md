# Step 31 - Business and Parts Discovery

Status: `not_started`
Dependencies: [Step 12](./12-explore-map.md), [Step 28](./28-promotion-event-ticketing.md)

## Goal

เพิ่ม discovery สำหรับ workshop, shop, parts/accessories และ services ผ่าน business profiles/map โดยยังไม่สร้าง full marketplace

## Architecture Decisions

MVP เป็น discovery/contact/external purchase เท่านั้น; sponsored placement ต้อง label ชัด Business verification/moderation แยกจาก ranking และ product catalog/shipping deferred

## Deliverables

- [ ] businesses, locations, categories, offers/links และ favorites migrations
- [ ] business CRUD/verification/moderation APIs และ mobile profile
- [ ] map markers/filters, opening info, media, vehicle-category tags และ external links
- [ ] admin/reporting และ sponsored placement integration

## Data/API Contracts

categories ครอบคลุม workshop, tire, gear, car/motorcycle/bicycle accessories, tuning, detailing และ other; links ใช้ allow-listed schemes พร้อม `sponsored`/`verified` flags

## Implementation Tasks

- [ ] model multiple locations/hours/categories ต่อ business
- [ ] link vehicle pages ไป relevant discovery filters
- [ ] validate external contact/purchase URLs และ track outbound click privacy-safely
- [ ] rank organic results แยกจาก explicitly sponsored slots

## Security

admin-only verification, moderation/reporting, URL sanitization และห้าม sponsored content ปลอมเป็น organic recommendation

## Test Plan

- [ ] business/location/hours/category/RLS tests
- [ ] map filter, favorite, moderation และ sponsored-label tests
- [ ] Playwright garage -> relevant shops -> directions/contact flow `th/en`

## Acceptance Criteria

- [ ] ผู้ใช้ค้น business ตามตำแหน่ง/category/vehicle และเปิด directions/contact ได้
- [ ] verified/sponsored labels ถูกต้องทุก surface
- [ ] ไม่มี stock, checkout, shipping หรือ seller payout สำหรับ parts

## Out of Scope

Product catalog, inventory, compatibility engine, marketplace checkout, returns, logistics, tax และ affiliate settlement automation

## Handoff to Next Step

Roadmap 01-31 เสร็จสิ้น; ทำ production readiness review เทียบ Security, Performance, Observability และ Analytics checklist ใน master planก่อนเปิด expansion
