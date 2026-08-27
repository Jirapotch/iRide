# Step 04 - Profiles

Status: `in_progress`
Dependencies: [Step 03](./03-authentication.md)

## Goal

สร้าง public identity ที่แก้ไขได้และมี username/visibility ชัดเจน

## Architecture Decisions

`profiles.id` เท่ากับ `auth.users.id`; private trigger สร้าง minimal profile หลัง signup และ username เปลี่ยนได้ทุก 30 วัน รูป avatar/cover เก็บ nullable UUID contract โดยเพิ่ม foreign key และ mutation path เมื่อ media schema พร้อม ใช้ clean URL และ locale จาก `iride-locale` cookie

## Deliverables

- [x] `profiles` migration, trigger, indexes และ RLS
- [x] onboarding/edit/public profile UI และ API
- [x] username normalization, reserved names และ visibility `public|followers|private`
- [x] avatar/cover placeholder contract สำหรับ media integration

## Data/API Contracts

`profiles(id, username, display_name, bio, avatar_media_id, cover_media_id, location_name, latitude, longitude, visibility, username_changed_at, created_at, updated_at)`; `GET /api/v1/users/:username`, `GET/PATCH /api/v1/profile/me`; web ใช้ `/onboarding`, `/profile/edit`, `/users/:username`

## Implementation Tasks

- [x] validate lowercase canonical username และ database uniqueness
- [x] owner-only update; public lookup เคารพ visibility
- [x] สร้าง derived profile completion state และ localized mobile pages
- [x] เตรียม nullable media UUIDs โดยไม่เก็บ raw image URL; foreign keys รอ media schema

## Security

ห้ามเปิด email/auth metadata; location coordinates ไม่อยู่ใน public column grants/DTO และ owner fields ต้อง filter server-side `followers` ทำงานเหมือน `public` ชั่วคราวจน Step 09 เพิ่ม follow graph

## Test Plan

- [x] migration/RLS tests สำหรับ owner/public/private
- [x] API validation/conflict/not-found tests
- [x] Playwright onboarding/edit/public profile ทั้งสอง locale

## Acceptance Criteria

- [x] signup สร้าง profile เสมอและ username ซ้ำไม่ได้
- [x] owner แก้ได้ ผู้ใช้อื่นแก้ไม่ได้ และ visibility มีผลจริงใน API/E2E mock
- [x] UI ไม่มี raw auth/private fields

## Out of Scope

Follows, garage, full media upload และ recommendation

## Handoff to Next Step

ส่ง owner/visibility conventions ให้ [Step 05](./05-media-abstraction.md)

## Implementation Notes

- เพิ่ม forward-only migration แก้ trigger ให้ตรวจ reserved username ภายใน `private.prepare_profile_write()` โดยไม่ grant schema `private` แก่ `authenticated`
- API แยก database failure เป็น `PROFILE_UPDATE_FAILED` 503; web ใช้ validation schema เดียวกับ API และแสดง field errors
- เพิ่ม logout ใน onboarding และ AppShell สำหรับ session ทั้ง mobile/desktop พร้อม Playwright coverage
- Automated lint, TypeScript, unit tests 87 รายการ, production builds และ mobile Playwright 15 รายการผ่านแล้ว
- เครื่องที่ใช้ตรวจไม่มี Docker/Podman จึงต้องให้ CI รัน database reset, pgTAP, type drift และ advisors ก่อน deploy
- ก่อนเปลี่ยนสถานะเป็น `done` ต้องให้ database gates ผ่าน, deploy migration แบบ forward-only และทำ production smoke ทั้ง save/persistence/logout ตาม Definition of Done
