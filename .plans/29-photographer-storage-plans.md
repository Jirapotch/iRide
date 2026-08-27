# Step 29 - Photographer Storage Plans

Status: `not_started`
Dependencies: [Step 27](./27-payouts.md)

## Goal

ควบคุมต้นทุน original storage ด้วย configurable plans/add-ons โดยไม่ทำลายสิทธิ์ผู้ซื้อ

## Architecture Decisions

นับ original bytes เท่านั้นใน quota เริ่มต้น; derived variants เป็น platform cost แยก Track `used + reserved`; plan limits/prices อยู่ business settings ไม่ hard-code และ downgrade ไม่ auto-delete originals

## Deliverables

- [ ] plans, subscriptions, addons, usage snapshots/events และ reservations migrations
- [ ] quota-aware upload authorization และ release/reconcile jobs
- [ ] photographer usage/dashboard/manage/archive UI และ admin cost analytics
- [ ] billing adapter boundary โดยยัง reuse Opn/order ledger

## Data/API Contracts

quota decision `{ usedBytes,reservedBytes,limitBytes,requestedBytes,allowed }`; reservation มี expiry/idempotency; purchased-entitled originals ถูก retention lock

## Implementation Tasks

- [ ] reserve bytes atomicallyก่อน presign และ settle actual size หลัง HEAD
- [ ] warn thresholds, block new uploads เมื่อเกิน และ expire abandoned reservations
- [ ] archive/delete workflow ตรวจ references/entitlements
- [ ] downgrade grace state และ admin reconciliation กับ R2 inventory

## Security

ห้าม client report usage เป็น truth; quota bypass service-only และ purchased originals ห้ามลบเงียบ

## Test Plan

- [ ] concurrent reservation/expiry/actual-size tests
- [ ] upgrade/downgrade/archive/entitlement retention tests
- [ ] R2-to-usage reconciliation และ dashboard tests

## Acceptance Criteria

- [ ] upload ไม่เกิน `used+reserved+requested` limit ภายใต้ concurrency
- [ ] usage rebuild จาก events/R2 ได้
- [ ] plan change ไม่ตัด buyer download entitlement

## Out of Scope

กำหนดราคา production, automatic destructive retention และ unlimited plan

## Handoff to Next Step

ส่ง photographer availability/storage status ให้ [Step 30](./30-photographer-map-spots.md)
