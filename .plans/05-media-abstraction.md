# Step 05 - Media Abstraction

Status: `not_started`
Dependencies: [Step 02](./02-supabase-foundation.md), [Step 04](./04-profiles.md)

## Goal

สร้าง central media model และ storage interface ก่อน domain อื่นเริ่มเก็บรูป

## Architecture Decisions

metadata อยู่ PostgreSQL, object bytes อยู่ private R2; domain tables อ้าง `media.id` เท่านั้น สถานะ `uploading|processing|ready|failed|deleted`

## Deliverables

- [ ] `media`, `media_variants`, lifecycle/audit fields, indexes และ RLS
- [ ] storage package สำหรับ sign put/get, head และ delete โดยไม่เผย credentials
- [ ] media service/repository, Zod schemas, typed errors และ ownership policy
- [ ] retention/orphan cleanup specification

## Data/API Contracts

`media` เก็บ owner, type, original object key, dimensions, bytes, MIME, filename, captured/location metadata และ status; `media_variants` เก็บ `thumbnail|preview|original`, object key, dimensions, bytes, MIME และ `watermarked`

## Implementation Tasks

- [ ] กำหนด collision-safe object keys ที่ไม่ใช้ filename เป็น authority
- [ ] enforce valid state transitions และ optimistic/idempotent updates
- [ ] ทำ API read metadata ที่ซ่อน original object key จาก unauthorized client
- [ ] กำหนด soft-delete, reference check และ orphan grace period

## Security

R2 bucket private, object key ถือเป็น sensitive metadata, owner สร้าง/ลบได้แต่ client ห้าม mark `ready` หรือสร้าง variants เอง

## Test Plan

- [ ] state machine/unit tests และ storage adapter contract tests
- [ ] migration/RLS tests สำหรับ owner/non-owner/service role
- [ ] API response test ยืนยันไม่มี private key leakage

## Acceptance Criteria

- [ ] domain ใช้ media IDs โดยไม่เก็บ URLs
- [ ] lifecycle/authorization ชัดเจนและ storage provider เปลี่ยนผ่าน adapter ได้
- [ ] deletion ไม่ทำลาย media ที่ยังถูกอ้างอิง

## Out of Scope

Upload endpoint, image processing และ UI gallery

## Handoff to Next Step

ส่ง media state/storage contracts ให้ [Step 06](./06-direct-image-upload.md)
