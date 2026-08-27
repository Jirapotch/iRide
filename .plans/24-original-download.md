# Step 24 - Original Download

Status: `not_started`
Dependencies: [Step 23](./23-photo-entitlements.md)

## Goal

ให้ผู้ซื้อที่มี active entitlement ดาวน์โหลด private original ผ่าน URL อายุสั้นและ audit ได้

## Architecture Decisions

API authorize ทุก request แล้ว sign R2 GET ช่วงสั้น; ไม่ proxy bytes ผ่าน Next.js และไม่ persist signed URL

## Deliverables

- [ ] download authorization endpoint และ audit/rate-limit records
- [ ] purchased-photo detail/download UI
- [ ] expiry, filename/content-disposition และ repeat-download policy

## Data/API Contracts

`GET /api/v1/photos/:id/download` คืน `{ url, expiresAt }` เฉพาะ active buyer; audit เก็บ profile/photo/entitlement/time/result และ privacy-safe request metadata

## Implementation Tasks

- [ ] authenticate -> load entitlement -> resolve original variant -> sign
- [ ] deny revoked/missing/not-ready originals ด้วย stable errors
- [ ] set safe download filename และ no-store response
- [ ] instrument success/denial โดยไม่ log signed URL

## Security

short TTL, private bucket, rate limit และ authorization ทุกครั้ง; UI/network ก่อน purchase ต้องไม่มี original key/URL

## Test Plan

- [ ] buyer/non-buyer/revoked/expired URL tests
- [ ] signed URL scope/content-disposition contract tests
- [ ] Playwright purchase library -> download และ network leakage audit

## Acceptance Criteria

- [ ] active buyer ดาวน์โหลด original ได้และผู้อื่นได้ 403/404 ตาม policy
- [ ] URL หมดอายุและใช้ได้เฉพาะ object ที่อนุญาต
- [ ] download events audit ได้โดยไม่เก็บ secret URL

## Out of Scope

Permanent public links, DRM และ offline sync

## Handoff to Next Step

ใช้ paid/download events ประกอบ reconciliation ใน [Step 25](./25-financial-ledger.md)
