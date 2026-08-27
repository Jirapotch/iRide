# Step 18 - Watermarked Previews

Status: `not_started`
Dependencies: [Step 07](./07-image-worker.md), [Step 17](./17-bulk-upload.md)

## Goal

สร้าง thumbnail/preview ที่ประเมินรูปได้แต่ไม่เปิด original แก่ผู้ไม่ซื้อ

## Architecture Decisions

original private; preview WebP long edge/quality เป็น config, watermark หลายตำแหน่งประกอบด้วย iRide, photographer identity และ photo reference ID; derived files ไว้ public/CDN-safe namespace

## Deliverables

- [ ] photographer-specific preview pipeline และ variant policies
- [ ] watermark renderer/font assets/config versioning
- [ ] CDN/cache headers และ photo readiness transitions
- [ ] leakage/security regression suite

## Data/API Contracts

required variants `thumbnail`, `preview`, `original`; public photo DTO คืนเฉพาะ thumbnail/preview URL และ `watermarked=true`; processing job บันทึก pipeline version

## Implementation Tasks

- [ ] normalize -> metadata -> resize -> watermark -> compress ตามลำดับ
- [ ] deterministic outputs และ regenerate เมื่อ pipeline version เปลี่ยน
- [ ] mark photo sale-ready เมื่อ required variants สำเร็จ
- [ ] handle corrupt/failed/retry พร้อม photographer UI

## Security

ตรวจ browser network/API/source maps ว่าไม่มี original URL/key; preview watermark ต้องฝังใน pixels ไม่ใช่ CSS overlay

## Test Plan

- [ ] golden-image tests ที่ tolerance เหมาะสม
- [ ] idempotency/failure/regeneration tests
- [ ] Playwright network inspection และ mobile screenshot sizes

## Acceptance Criteria

- [ ] published photo มี watermarked preview/thumbnail ที่อ่าน photographer/photo ID ได้
- [ ] unauthorized client หา original ผ่าน UI/API/network ไม่ได้
- [ ] duplicate job ให้ผล logical เดิม

## Out of Scope

DRM, screenshot prevention และ AI image search

## Handoff to Next Step

ส่ง safe public photo DTO ให้ [Step 19](./19-photo-marketplace-ui.md)
