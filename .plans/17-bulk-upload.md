# Step 17 - Bulk Upload

Status: `not_started`
Dependencies: [Step 06](./06-direct-image-upload.md), [Step 16](./16-photo-albums.md)

## Goal

รองรับ bulk direct upload ของ photographer พร้อม progress, resume และ per-file failure isolation

## Architecture Decisions

หนึ่ง media/job ต่อไฟล์, จำกัด concurrency ที่ client, batch เป็น orchestration record ไม่ใช่ transaction ใหญ่ และ retry ไม่สร้าง photo ซ้ำ

## Deliverables

- [ ] upload_batches/items model หรือ equivalent durable tracking
- [ ] batch authorize/complete/status/cancel APIs
- [ ] mobile/desktop uploader พร้อม aggregate/per-file progress และ resume
- [ ] album processing status และ safe partial completion

## Data/API Contracts

`POST /albums/:id/uploads` รับ file manifests; status DTO แยก `queued|uploading|processing|ready|failed|cancelled`; idempotency key ต่อ batch/file

## Implementation Tasks

- [ ] preflight totals, accepted types/count/bytes และ ownership
- [ ] presign เป็น page/chunk ไม่คืน URLs จำนวนไม่จำกัด
- [ ] bounded parallel upload, retry failed file และ restore state หลัง refresh
- [ ] create photo row exactly once เมื่อ upload completion valid

## Security

ทุก file ต้องผ่าน rules ของ Step 06; ห้ามให้ batch ข้าม photographer/album และ URLs ต้อง short-lived

## Test Plan

- [ ] duplicate/retry/partial/cancel API tests
- [ ] browser test refresh/resume/network failure
- [ ] load test ตาม configured max batch/concurrency

## Acceptance Criteria

- [ ] batch ใหญ่ไม่ผ่าน Next.js body และไฟล์ล้มเหลวไม่ทำลายไฟล์อื่น
- [ ] refresh/retry ไม่สร้าง duplicate photo/media
- [ ] progress ตรงกับ server state

## Out of Scope

Storage subscription quota และ watermark output

## Handoff to Next Step

ส่ง original photo jobs ให้ [Step 18](./18-watermarked-previews.md)
