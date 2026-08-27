# Step 06 - Direct Image Upload

Status: `not_started`
Dependencies: [Step 05](./05-media-abstraction.md)

## Goal

ให้ browser upload รูปตรงเข้า private R2 อย่างปลอดภัย โดย API ควบคุม quota, metadata และ completion

## Architecture Decisions

ใช้ short-lived presigned PUT, one authorization per object, client-declared metadata เป็น untrusted และ API ตรวจ R2 HEAD ก่อน enqueue

## Deliverables

- [ ] authorize/complete/cancel upload endpoints
- [ ] client uploader พร้อม progress, retry, cancellation และ mobile UX
- [ ] MIME/extension/size limits, checksum contract และ stale-upload cleanup
- [ ] queue message สำหรับ media processing

## Data/API Contracts

`POST /api/v1/media/uploads` คืน `{ mediaId, uploadUrl, headers, expiresAt }`; `POST /api/v1/media/:id/complete` ตรวจ object แล้วเปลี่ยนเป็น `processing`; queue payload `{ version, jobId, mediaId, objectKey, attempt }`

## Implementation Tasks

- [ ] authorize เฉพาะ authenticated owner และ accepted image types
- [ ] presign key ที่ server สร้างพร้อม content length/type constraints
- [ ] complete แบบ idempotent, HEAD object และ enqueue ใน transaction-safe flow
- [ ] UI ป้องกัน duplicate submit และแปล errors `th/en`

## Security

ห้าม proxy bytes ผ่าน Next.js, ห้าม trust EXIF/MIME จาก browser และห้ามคืน R2 secret/original GET URL

## Test Plan

- [ ] storage adapter integration tests สำหรับ expired/invalid signatures
- [ ] API tests: oversized, wrong MIME, wrong owner, duplicate complete
- [ ] Playwright upload progress/retry บน mobile viewport

## Acceptance Criteria

- [ ] รูป valid เข้า private R2 และได้ media state `processing`
- [ ] invalid/unauthorized uploads ถูกปฏิเสธและไม่สร้าง orphan ถาวร
- [ ] completion ซ้ำไม่สร้างงานซ้ำ

## Out of Scope

Variant generation, bulk album workflow และ storage subscriptions

## Handoff to Next Step

ส่ง queue payload และ uploaded object ให้ [Step 07](./07-image-worker.md)
