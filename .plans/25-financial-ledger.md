# Step 25 - Financial Ledger

Status: `not_started`
Dependencies: [Step 22](./22-opn-payments.md)

## Goal

ทำ double-entry ledger เป็น financial source of truth สำหรับ payment, commission, seller allocation, refund และ payout

## Architecture Decisions

amounts เป็น integer satang/THB; posted entries immutable; ทุก transaction ผลรวม debit=credit และอ้าง source idempotency key ห้ามใช้ mutable user `balance`

## Deliverables

- [ ] accounts, transactions, transaction_entries และ audit migrations
- [ ] chart of accounts สำหรับ cash/provider clearing, customer receivable, seller payable, platform revenue และ refunds
- [ ] posting service, reports และ automated invariants

## Data/API Contracts

transaction มี `source_type/source_id/idempotency_key/status`; entry มี account, debit/credit amount และ seller/order dimensions; reversal ใช้ transaction ใหม่ ไม่แก้ posted rows

## Implementation Tasks

- [ ] post verified payment/commission/seller payable atomically
- [ ] post full/partial refund และ later payout/reversal
- [ ] build order/provider/ledger reconciliation queries
- [ ] restrict posting ผ่าน domain commands เท่านั้น

## Security

ledger writes service-only, immutable triggers/permissions, admin reads audited และ financial PII minimized

## Test Plan

- [ ] property tests debit=credit/non-negative rules
- [ ] duplicate source, refund, reversal และ concurrent post tests
- [ ] reconciliation fixtures ครอบคลุม multi-seller orders

## Acceptance Criteria

- [ ] ทุก paid/refunded order reconcile provider/order/ledger ได้
- [ ] posted ledger mutate/delete ไม่ได้
- [ ] commission 10% snapshot และ seller allocations ตรง order items

## Out of Scope

Tax engine, FX, wallet และ production accounting export

## Handoff to Next Step

ส่ง seller-payable entries ให้ [Step 26](./26-seller-earnings.md)
