# Step 23 - Photo Entitlements

Status: `not_started`
Dependencies: [Step 22](./22-opn-payments.md)

## Goal

grant/revoke สิทธิ์ photo original จาก verified order แบบ exactly-once logical effect

## Architecture Decisions

entitlement เป็น authorization record แยกจาก photo/order status; unique ต่อ profile/photo/order item และ refund policy ระบุ revoke state อย่าง explicit

## Deliverables

- [ ] photo_entitlements migration/RLS และ audit fields
- [ ] paid-order entitlement service/job และ revocation flow
- [ ] purchased library API/UI

## Data/API Contracts

`photo_entitlements(id,profile_id,photo_id,order_item_id,license_type,granted_at,revoked_at,reason)`; `GET /me/photos`; domain event keyed by order/payment transaction

## Implementation Tasks

- [ ] grant all eligible order items transactionally/idempotently
- [ ] map refund/chargeback policy to revoke/retain decision
- [ ] expose active entitlements onlyใน buyer library
- [ ] audit actor/source for grant/revoke

## Security

client/seller ห้าม grant entitlement; RLS owner read only และ service mutation only

## Test Plan

- [ ] duplicate paid event/partial refund/revocation tests
- [ ] RLS and purchased-library API tests
- [ ] invariant: unpaid/cancelled order มี active entitlement เป็นศูนย์

## Acceptance Criteria

- [ ] paid buyer ได้ entitlement ครบหนึ่งครั้ง
- [ ] unauthorized user/seller สร้างหรืออ่านสิทธิ์ผู้อื่นไม่ได้
- [ ] refund/revoke มี audit trail

## Out of Scope

Signed download URL และ license document customization

## Handoff to Next Step

ส่ง active entitlement check ให้ [Step 24](./24-original-download.md)
