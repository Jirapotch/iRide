# Step 19 - Photo Marketplace UI

Status: `not_started`
Dependencies: [Step 18](./18-watermarked-previews.md)

## Goal

ให้ลูกค้าค้น album/photo ผ่าน event, place และ photographer แล้วดู/select previews บน mobile ได้

## Architecture Decisions

public browse ใช้ cursor pagination, thumbnail-first grid และ preview viewer; search MVP ใช้ metadata/filter เท่านั้น

## Deliverables

- [ ] marketplace landing, album listing/detail, photo grid/viewer และ favorites
- [ ] event/place/photographer filters และ shareable URLs
- [ ] multi-select state handoff สู่ cart
- [ ] analytics events สำหรับ album/photo/select funnel

## Data/API Contracts

`GET /albums`, `/albums/:id`, `/photos/:id`, favorites endpoints; DTO คืน price THB minor units, sale status และ preview variants เท่านั้น

## Implementation Tasks

- [ ] responsive virtualized/lazy grid และ accessible viewer
- [ ] preserve filters/selection across navigation
- [ ] favorites idempotent และ authenticated prompt
- [ ] track views โดยไม่เก็บ sensitive raw data

## Security

ห้าม preload original; sanitize album content และ rate-limit view/favorite writes

## Test Plan

- [ ] pagination/filter/favorite API tests
- [ ] component accessibility/selection tests
- [ ] Playwright browse -> viewer -> multi-select ทั้ง `th/en`

## Acceptance Criteria

- [ ] customer หาและเลือกรูปจาก published inventory ได้บน mobile
- [ ] prices/status/variants ถูกต้องและไม่มี original leakage
- [ ] funnel analytics ไม่ block UX

## Out of Scope

AI similarity, OCR, checkout และ paid entitlement

## Handoff to Next Step

ส่ง selected photo IDs/pricing DTO ให้ [Step 20](./20-cart.md)
