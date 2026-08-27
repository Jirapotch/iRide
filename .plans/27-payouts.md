# Step 27 - Payouts

Status: `not_started`
Dependencies: [Step 26](./26-seller-earnings.md)

## Goal

จบ Commerce Beta ด้วย admin-recorded manual payout ที่ reserve/settle earnings และ reconcile ได้

## Architecture Decisions

ยังไม่เรียก Opn Transfer; admin สร้าง batch, บันทึก external bank reference และยืนยัน paid หลังโอนจริง ต้องผ่าน legal/provider review ก่อน automation

## Deliverables

- [ ] payout_batches, payouts, payout_items/status history migrations
- [ ] threshold/eligibility, create/approve/mark-paid/fail/retry admin workflow
- [ ] seller payout history และ reconciliation report
- [ ] Commerce Beta end-to-end suite

## Data/API Contracts

states `draft|approved|processing|paid|failed|cancelled`; payout snapshot ระบุ ledger payable entries, amount, seller และ external reference; paid transition post ledger transaction

## Implementation Tasks

- [ ] lock/reserve eligible earnings ป้องกัน double payout
- [ ] dual-step admin confirmation และ immutable paid reference
- [ ] release reservation เมื่อ fail/cancel ตาม policy
- [ ] reconcile batch totals กับ bank references/ledger

## Security

admin-only audited actions, least privilege, mask bank data และ production launch gate ต้องมี legal/ops approval

## Test Plan

- [ ] concurrent batch/double payout/failure/retry tests
- [ ] ledger posting/reconciliation/authorization tests
- [ ] full Commerce Beta: cart -> order -> Opn webhook -> entitlement -> download -> ledger -> payout

## Acceptance Criteria

- [ ] earnings เดียวไม่อยู่มากกว่าหนึ่ง active payout
- [ ] paid payout reconcile ledger และ external reference ได้
- [ ] Commerce Beta ผ่านโดยไม่มี automatic transfer หรือ mutable balance

## Out of Scope

Opn Transfer automation, wallet, tax filing และ cross-border payout

## Handoff to Next Step

freeze commerce contracts ก่อนเริ่ม [Step 28](./28-promotion-event-ticketing.md)
