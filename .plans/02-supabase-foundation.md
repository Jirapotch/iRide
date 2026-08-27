# Step 02 - Supabase Foundation

Status: `done`
Dependencies: [Step 01](./01-repository.md)
Completed: `2026-08-27`
Commit/PR: working tree; no commit requested

## Goal

ทำ local/production Supabase ให้ recreate ได้จาก migrations + seed พร้อมฐานสำหรับ Auth, PostGIS, Realtime, RLS และ Queues

## Architecture Decisions

SQL migrations เป็น source of truth; ใช้ `supabase-js` กับ generated types ไม่มี ORM เปิด `postgis`, `pgmq`, `pgcrypto` และ extensions เท่าที่ migration ระบุ Queue ไม่เปิดให้ browser

## Deliverables

- [x] `supabase/config.toml`, migrations, deterministic seed และ database tests
- [x] environment แยก local/production และ database client package แบบ browser/server/admin
- [x] migration workflow, type generation command และ CI drift check
- [x] baseline roles, grants, RLS conventions และ queue helper functions

## Data/API Contracts

กำหนด `public`, private/internal schemas และ generated `Database` type; timestamp เป็น UTC `timestamptz`, PK ใช้ UUID, money ใช้ integer minor units, geo ใช้ `geography(Point,4326)`

## Implementation Tasks

- [x] init local Supabase และสร้าง baseline migration
- [x] enable extensions และสร้าง safe `updated_at` helper
- [x] สร้าง seed identities/fixtures ที่ไม่ใช้ production secrets
- [x] แยก anon/authenticated/service-role privileges และ deny-by-default RLS template
- [x] สร้าง durable queues และกำหนด visibility/retry/archive conventions

## Security

service role ใช้เฉพาะ API/worker; ทุก sensitive table ต้อง enable RLS ก่อน grant และ security-definer function ต้อง set empty `search_path` ไม่มี staging project ตาม [ADR 0008](../docs/adr/0008-supabase-environments.md); production bootstrap ต้อง backup และผ่าน manual approval

## Test Plan

- [x] `supabase db reset` สร้าง schema/seed สำเร็จซ้ำได้
- [x] database tests ตรวจ extensions, grants, RLS deny defaults และ queue access
- [x] generated types ไม่ drift หลัง migration

## Acceptance Criteria

- [x] local และ production bootstrap recreate ได้จาก versioned files เท่านั้น
- [x] anon ไม่อ่าน private/internal data และ browser เข้า queue ไม่ได้
- [x] apps เชื่อม database ผ่าน shared client package ได้

## Out of Scope

Domain tables, production data migration และ Supabase Storage สำหรับ media

## Handoff to Next Step

ส่ง migration/RLS/type workflow ให้ [Step 03](./03-authentication.md)

## Completion Notes

- Production project `bgflnssilreepfzxoqpc` ถูก backup เป็น ignored JSON data/schema metadata แล้ว reset จาก migrations + deterministic seed สำเร็จ
- migration history local/remote ตรงกัน 3 files; pgTAP ผ่าน 37 tests และ advisors ไม่มี error
- Supabase hosted ใช้ `pgmq 1.5.1`; corrective migration ทำ `read_jobs` ให้ใช้ contract ที่รองรับ โดยยัง forward-compatible กับ local extension รุ่นใหม่
- local Docker ไม่มีในเครื่องนี้ จึงกำหนด CI database job ให้ reset ซ้ำสองรอบ, รัน pgTAP, type drift และ advisors เป็น authoritative local-stack check
- Security Advisor เหลือ warning `auth_leaked_password_protection`; ส่งต่อให้ Step 03 เปิดพร้อม Auth policy
