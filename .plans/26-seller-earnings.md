# Step 26 - Seller Earnings

Status: `not_started`
Dependencies: [Step 25](./25-financial-ledger.md)

## Goal

แสดง pending, available และ paid earnings ต่อ photographer จาก ledger โดยไม่สร้าง balance truth ซ้ำ

## Architecture Decisions

ยอดคำนวณจาก ledger views/projections; settlement hold และ payout threshold เป็น configurable settings พร้อม effective dates

## Deliverables

- [ ] seller earnings projection/view และ availability policy
- [ ] photographer dashboard/history/export API/UI
- [ ] admin reconciliation และ projection rebuild command

## Data/API Contracts

`GET /photographer/me/earnings` คืน pending/available/paid + paginated movements; projection row ต้องอ้าง ledger transaction และห้ามเป็น authoritative balance

## Implementation Tasks

- [ ] derive lifecycle จาก sale/refund/dispute/hold dates
- [ ] calculate seller-specific totals ใน multi-seller order
- [ ] rebuild/compare projection กับ ledger
- [ ] localized THB display โดยไม่ใช้ float arithmetic

## Security

seller เห็นเฉพาะ earnings ตน; admin access audited และ DTO ไม่รั่ว customer payment details

## Test Plan

- [ ] hold release/refund/dispute/multi-seller projection tests
- [ ] rebuild parity และ authorization tests
- [ ] dashboard mobile `th/en` tests

## Acceptance Criteria

- [ ] pending+available+paid อธิบายย้อนถึง ledger entries ได้
- [ ] projection rebuild แล้วผลเดิม
- [ ] refund/dispute ปรับยอดโดยไม่แก้ historical entries

## Out of Scope

Automatic transfer, tax withholding และ multi-currency

## Handoff to Next Step

ส่ง available earnings ให้ [Step 27](./27-payouts.md)
