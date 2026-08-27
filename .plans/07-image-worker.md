# Step 07 - Image Worker

Status: `not_started`
Dependencies: [Step 06](./06-direct-image-upload.md)

## Goal

ประมวลผลรูปแบบ asynchronous ให้ได้ normalized metadata และ reusable thumbnail โดย retry ได้อย่างปลอดภัย

## Architecture Decisions

Railway รัน Node worker + `sharp`; worker pull Supabase Queue ด้วย service role, ใช้ visibility timeout และ deterministic variant keys งานทุกชนิด idempotent

## Deliverables

- [ ] queue consumer, concurrency/backoff/shutdown และ health/metrics
- [ ] decode validation, orientation normalization, EXIF sanitation และ thumbnail generation
- [ ] media/variant atomic state updates, failure reason และ dead-letter/archive handling
- [ ] retry/admin requeue command และ orphan cleanup job

## Data/API Contracts

consumer รับ versioned payload จาก Step 06; output variant `thumbnail` เป็น WebP ค่า dimensions/quality มาจาก config และบันทึก actual metadata ห้ามเปลี่ยน `ready` ก่อน required outputs ครบ

## Implementation Tasks

- [ ] ตรวจ magic bytes/decode/limits ก่อน processing
- [ ] strip unsafe metadata แต่เก็บ captured/location เฉพาะ policy อนุญาต
- [ ] upload temp output แล้ว promote/update DB แบบ retry-safe
- [ ] structured logs ผูก `jobId`, `mediaId`, attempt และ duration

## Security

จำกัด pixels/bytes/concurrency ป้องกัน decompression bomb; logs ห้ามมี EXIF location/object credentials

## Test Plan

- [ ] fixtures: JPEG/PNG/WebP, rotated, corrupt, oversized และ retry
- [ ] contract test queue visibility/idempotency/dead-letter
- [ ] end-to-end upload -> thumbnail -> `ready`

## Acceptance Criteria

- [ ] valid image สร้าง thumbnail และ metadata ถูกต้อง
- [ ] duplicate delivery ไม่สร้าง duplicate variant และ failure retry/inspect ได้
- [ ] synchronous API ไม่มี `sharp` processing

## Out of Scope

Marketplace watermark/preview และ video

## Handoff to Next Step

ส่ง ready-media contract ให้ [Step 08](./08-garage.md)
