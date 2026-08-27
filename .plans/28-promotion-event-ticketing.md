# Step 28 - Promotion and Event Ticketing

Status: `not_started`
Dependencies: [Step 27](./27-payouts.md)

## Goal

เพิ่ม iRide-owned promotions และ event ticketing โดย reuse orders/payments/ledger แต่แยก promotional credits จาก seller earnings

## Architecture Decisions

promotion products configurable (`boost_post`, `promote_event`, `featured_photographer`, `featured_garage`, `sponsored_place`, `business_profile`); ticket inventory reserve transactionally, QR token opaque/signed และ organizer payout hold จน event complete

## Deliverables

- [ ] promotions/campaigns/impressions และ tickets/inventory/check-ins migrations
- [ ] purchase/activation/labeling APIs และ organizer/admin UIs
- [ ] QR issue/check-in, refund/cancellation และ event settlement flows

## Data/API Contracts

promotion/ticket order items ใช้ typed product snapshot; ticket states `reserved|issued|checked_in|cancelled|refunded`; public promoted content ต้องมี `sponsored=true`

## Implementation Tasks

- [ ] configure products/budgets/schedules และ transparent placement
- [ ] reserve/release ticket inventory ป้องกัน oversell
- [ ] generate single-use QR token และ atomic check-in
- [ ] post revenue/organizer payable/refunds ผ่าน ledger accounts แยก

## Security

ห้ามผสม promotional credit กับ seller payable; QR replay protection, organizer-scoped permissions และ sponsored labeling บังคับ server-side

## Test Plan

- [ ] campaign schedule/budget/label tests
- [ ] concurrent inventory, QR replay, refund และ payout-hold tests
- [ ] mobile purchase/check-in flow `th/en`

## Acceptance Criteria

- [ ] promoted content ระบุชัดและไม่บิด organic data
- [ ] ticket ไม่ oversell/check-in ซ้ำ และ organizer earnings reconcile ได้
- [ ] finance accounts แยก photo, promotion และ ticketing

## Out of Scope

General credits wallet, dynamic ad auction และ external ticket resale

## Handoff to Next Step

ส่ง subscription-compatible commerce primitives ให้ [Step 29](./29-photographer-storage-plans.md)
