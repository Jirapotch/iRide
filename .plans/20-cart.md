# Step 20 - Cart

Status: `not_started`
Dependencies: [Step 19](./19-photo-marketplace-ui.md)

## Goal

สร้าง multi-photographer cart ที่คำนวณราคาใหม่จาก server และพร้อมเปลี่ยนเป็น order

## Architecture Decisions

cart เก็บ server-side สำหรับ authenticated user; client state เป็น cache เท่านั้น รองรับหลาย seller ใน checkout เดียวและ THB เท่านั้น

## Deliverables

- [ ] carts/cart_items migrations/RLS หรือ durable draft-cart model
- [ ] add/remove/list/clear APIs และ cart page/mobile summary
- [ ] server pricing, availability validation และ seller grouping
- [ ] Photographer Beta acceptance suite

## Data/API Contracts

`POST /cart/items { photoId }`, `DELETE /cart/items/:photoId`, `GET /cart`; response คืน item totals, seller subtotals, discounts และ grand total จาก server

## Implementation Tasks

- [ ] unique cart item ต่อ profile/photo และ idempotent add
- [ ] revalidate sale status/price ทุก read และก่อน order
- [ ] mark unavailable items โดยไม่ silently charge
- [ ] bundle/discount interface โดยยังไม่ hard-code campaign logic

## Security

ห้ามรับราคา/seller จาก client; RLS owner-only และ cart ไม่ grant original access

## Test Plan

- [ ] multi-seller, duplicate, price-change, unavailable และ auth tests
- [ ] totals/rounding property tests ใน integer satang
- [ ] Playwright select -> cart -> edit cart บน mobile

## Acceptance Criteria

- [ ] cart รวมหลาย photographer และ totals ตรง server
- [ ] stale price/inventory แสดงให้ผู้ใช้ยืนยันก่อน checkout
- [ ] Photographer Beta ตั้งแต่ upload ถึง cart ผ่านโดยไม่มี commerce side effect

## Out of Scope

Order reservation, Opn payment และ entitlement

## Handoff to Next Step

ส่ง validated cart snapshot contract ให้ [Step 21](./21-orders.md)
