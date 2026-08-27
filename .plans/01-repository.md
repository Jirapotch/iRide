# Step 01 - Repository

Status: `done`
Dependencies: none
Completed: `2026-08-27`
Commit/PR: working tree; no commit requested

## Goal

Bootstrap monorepo ที่ทุก app/package install, lint, typecheck, test และ build ได้ โดยยังไม่มี business feature

## Architecture Decisions

ใช้ pnpm/Turborepo, Node 22, TypeScript strict, Next.js แยก `apps/web`/`apps/api`, Node `apps/worker`, Tailwind/shadcn และ shared packages ตาม [baseline](./README.md#architecture-baseline) ก่อนสร้าง Next.js code ให้อ่าน guide ใน `node_modules/next/dist/docs/`

## Deliverables

- [x] workspace, Turbo pipeline, pinned package manager และ lockfile
- [x] `apps/web`, `apps/api`, `apps/worker` และ shared packages ทั้งแปด
- [x] ESLint, Prettier, Vitest, Playwright, shared TS config และ environment validation
- [x] `.gitignore` ที่เก็บ `.plans` ไว้ใน Git, `.env.example`, local setup README, Dockerfile สำหรับ worker และ GitHub Actions CI
- [x] ADRs สำหรับ app boundaries, Supabase, R2, pgmq, MapTiler, Opn และ deployment targets

## Data/API Contracts

ยังไม่มี business schema/API; health endpoints `GET /api/health` ของ web/api และ worker health probe คืน `{ status, service, version }`

## Implementation Tasks

- [x] กำหนด root scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `check`
- [x] ทำ package exports และ dependency boundaries ไม่ให้ web import worker infrastructure
- [x] validate public/server secrets แยกกันและ fail fast เมื่อ server config ขาด
- [x] CI ใช้ `pnpm install --frozen-lockfile` และรัน quality pipeline
- [x] ลบ historical ignore rule `/.plans/` และตรวจว่า plan files ปรากฏใน Git status
- [x] README อธิบาย prerequisites, env, local commands และ app ports

## Security

ห้าม commit secrets; browser bundle import ได้เฉพาะ public config และ service-role/R2/Opn secret ต้องเป็น server-only

## Test Plan

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- [x] health endpoints และ worker container smoke test

## Acceptance Criteria

- [x] ทั้งสาม apps และ shared packages build ผ่านจาก clean checkout
- [x] CI ครบ lint/typecheck/test/build และไม่มี business feature
- [x] architecture decisions และ local setup ทำให้ Agent เริ่ม Step 02 ได้โดยไม่ต้องเลือก stack เพิ่ม

## Out of Scope

Supabase schema, auth UI, domain models และ production deployment

## Handoff to Next Step

ส่ง workspace commands, env schema และ ADRs ให้ [Step 02](./02-supabase-foundation.md)

## Completion Notes

- Verification ผ่าน: `pnpm install --frozen-lockfile`, `pnpm check` และ `pnpm test:e2e`
- health contracts ผ่าน unit/integration tests ทั้ง web, API และ worker; Docker build stage ผ่านการจำลองจาก frozen lockfile
- full worker container smoke ถูกกำหนดใน GitHub Actions เพราะเครื่อง local นี้ไม่มี Docker
- local verification ใช้ Node 24.19.0; repository, CI และ worker image pin Node 22
