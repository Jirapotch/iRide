# Step 04 - Profiles

Status: `not_started`
Dependencies: [Step 03](./03-authentication.md)

## Goal

สร้าง public identity ที่แก้ไขได้และมี username/visibility ชัดเจน

## Architecture Decisions

`profiles.id` เท่ากับ `auth.users.id`; trigger สร้าง minimal profile หลัง signup และ username เปลี่ยนได้ภายใต้ uniqueness/cooldown policy รูป avatar/cover อ้าง `media` เมื่อ Step 07 พร้อม

## Deliverables

- [ ] `profiles` migration, trigger, indexes และ RLS
- [ ] onboarding/edit/public profile UI และ API
- [ ] username normalization, reserved names และ visibility `public|followers|private`
- [ ] avatar/cover placeholder contract สำหรับ media integration

## Data/API Contracts

`profiles(id, username, display_name, bio, avatar_media_id, cover_media_id, location_name, latitude, longitude, visibility, created_at, updated_at)`; `GET /api/v1/users/:username`, `GET/PATCH /api/v1/profile/me`

## Implementation Tasks

- [ ] validate lowercase canonical username และ case-insensitive unique index
- [ ] owner-only update; public lookup เคารพ visibility
- [ ] สร้าง profile completion state และ localized mobile pages
- [ ] เตรียม nullable media FKs โดยไม่เก็บ raw image URL

## Security

ห้ามเปิด email/auth metadata; location coordinates ไม่แสดงใน public profile โดย default และ owner fields ต้อง filter server-side

## Test Plan

- [ ] migration/RLS tests สำหรับ owner/public/private
- [ ] API validation/conflict/not-found tests
- [ ] Playwright onboarding/edit/public profile ทั้งสอง locale

## Acceptance Criteria

- [ ] signup สร้าง profile เสมอและ username ซ้ำไม่ได้
- [ ] owner แก้ได้ ผู้ใช้อื่นแก้ไม่ได้ และ visibility มีผลจริง
- [ ] UI ไม่มี raw auth/private fields

## Out of Scope

Follows, garage, full media upload และ recommendation

## Handoff to Next Step

ส่ง owner/visibility conventions ให้ [Step 05](./05-media-abstraction.md)
