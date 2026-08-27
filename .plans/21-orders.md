# Step 21 - Orders

Status: `not_started`
Dependencies: [Step 20](./20-cart.md)

## Goal

แปลง cart เป็น immutable-priced multi-seller order พร้อม state machine และ idempotency

## Architecture Decisions

states `draft|pending_payment|paid|cancelled|refunded|partially_refunded`; item snapshot เก็บ photo, seller, unit price, commission rate 10%, commission amount และ seller allocation

## Deliverables

- [ ] photo_orders/order_items/seller_allocations migrations, constraints และ RLS
- [ ] create/get/history/cancel APIs
- [ ] transaction-safe cart checkout snapshot และ idempotency records

## Data/API Contracts

`POST /orders` รับ cart/version + idempotency key ไม่รับราคา; `GET /orders/:id`; amounts เป็น integer satang, currency `THB`, snapshots immutable หลัง pending payment

## Implementation Tasks

- [ ] revalidate cart inventory/price และคำนวณ totals ใน transaction
- [ ] snapshot configurable commission 10% ต่อ item
- [ ] enforce allowed order transitions และ unique idempotency response
- [ ] preserve multi-seller allocations/refund capacity

## Security

owner อ่าน order ตนเอง; seller เห็นเฉพาะ allocation ที่อนุญาต; client ห้าม set `paid`

## Test Plan

- [ ] concurrency/idempotency/state machine tests
- [ ] totals/rounding/multi-seller/refund-bound tests
- [ ] RLS/order history API tests

## Acceptance Criteria

- [ ] retry create order คืน order เดิม
- [ ] frozen totals/commission/seller allocations reconcile กัน
- [ ] paid state เปลี่ยนได้เฉพาะ verified payment flow

## Out of Scope

Provider calls, ledger entries และ entitlement

## Handoff to Next Step

ส่ง pending-payment order contract ให้ [Step 22](./22-opn-payments.md)
