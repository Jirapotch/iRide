# Step 22 - Opn Payments

Status: `not_started`
Dependencies: [Step 21](./21-orders.md)

## Goal

รับ THB ผ่าน Opn PromptPay/cards 3DS โดยยืนยันผล server-side และ reconcile ได้

## Architecture Decisions

สร้าง charge จาก server; card data tokenize ผ่าน Omise.js เท่านั้น; redirect/UI success ไม่เปลี่ยน order เป็น paid Webhook `charge.complete` ต้อง retrieve charge จาก Opn และ process idempotently

## Deliverables

- [ ] payment_attempts/provider_events/refunds/disputes migrations
- [ ] create payment, return/status และ webhook endpoints
- [ ] Opn adapter, test/live env separation, reconciliation job และ admin diagnostics
- [ ] PromptPay/card mobile checkout UI `th/en`

## Data/API Contracts

`POST /orders/:id/payments`, `GET /orders/:id/payment`, `POST /webhooks/opn`; เก็บ provider IDs, raw event reference/hash, normalized status และ amounts โดยไม่เก็บ card data

## Implementation Tasks

- [ ] create source/token/charge ตาม method และ return URI allow-list
- [ ] persist attempt ก่อน external call และ map pending/success/failure/expiry
- [ ] dedupe event, retrieve charge, verify order metadata/amount/currency แล้ว transition transactionally
- [ ] implement refund/dispute states และ scheduled reconciliation

## Security

secret key server-only; webhook body ถือเป็น untrusted จน retrieve provider object สำเร็จ; redact payment logs และ rate-limit endpoints

## Test Plan

- [ ] adapter contract tests ด้วย Opn test mode/fixtures
- [ ] forged/duplicate/out-of-order webhook และ amount mismatch tests
- [ ] Playwright PromptPay/card success/failure/cancel โดยไม่ grant access ก่อน webhook

## Acceptance Criteria

- [ ] verified successful charge เท่านั้นทำ order paid
- [ ] duplicate/out-of-order events ไม่ double-process
- [ ] failed/refund/dispute ตรวจสอบและ reconcile ได้

## Out of Scope

Automatic seller transfer, multi-currency และ wallet

## Handoff to Next Step

ส่ง verified paid-order event ให้ [Step 23](./23-photo-entitlements.md) และ [Step 25](./25-financial-ledger.md)
