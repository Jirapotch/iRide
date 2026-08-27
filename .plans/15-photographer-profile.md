# Step 15 - Photographer Profile

Status: `not_started`
Dependencies: [Step 04](./04-profiles.md), [Step 14](./14-communities.md)

## Goal

เพิ่ม photographer capability ให้ profile เดิม โดยไม่สร้าง identity แยก

## Architecture Decisions

`photographers.profile_id` unique; activation เป็น opt-in role, verification แยกจาก account auth และ service area เก็บเป็น structured region/geo metadata

## Deliverables

- [ ] photographers migration/RLS และ onboarding/edit API
- [ ] public photographer profile, portfolio shell และ discovery list
- [ ] verification/service-area/event association contracts

## Data/API Contracts

`photographers(id,profile_id,display_name,bio,service_area,verified,timestamps)`; `GET /photographers`, `GET /photographers/:username`, `POST/PATCH /photographer/me`

## Implementation Tasks

- [ ] prevent duplicate photographer identity
- [ ] expose only public profile/ready portfolio media
- [ ] discovery filters by service area/verified status
- [ ] admin-only verification with audit record

## Security

verification cannot be self-assigned; exact private contact/location ไม่อยู่ public DTO

## Test Plan

- [ ] uniqueness/RLS/verification tests
- [ ] discovery/filter/API tests
- [ ] Playwright onboarding/public profile `th/en`

## Acceptance Criteria

- [ ] normal user opt in เป็น photographer และยังใช้ profile เดิม
- [ ] public discovery/portfolio shell ทำงานและ privacy ถูกต้อง
- [ ] verification controlled by admin

## Out of Scope

Albums, uploads, subscription และ payouts

## Handoff to Next Step

ส่ง photographer ID/profile DTO ให้ [Step 16](./16-photo-albums.md)
