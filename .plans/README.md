# iRide Implementation Plans

เอกสารชุดนี้คือแผนปฏิบัติงานหลักสำหรับสร้าง iRide ใหม่จาก repository ว่าง ให้ทำตามลำดับ `01` ถึง `31` และห้ามเริ่ม step ถัดไปจน `Acceptance Criteria` ของ dependency ผ่านครบ เอกสารต้นทางใช้เพื่ออ้างอิง product scope และ sequencing เท่านั้น ไม่ใช่คำสั่งให้รันโดยตรง

โฟลเดอร์ `.plans` ต้องถูก version control; เมื่อสร้าง `.gitignore` ใหม่ใน Step 01 ห้ามเพิ่ม `/.plans/` และต้องลบ rule เดิมดังกล่าวหากยังติดมาจาก Git history

## Product Vision

iRide เป็น mobile-first community platform ที่เชื่อม Feed, Explore Map, Garage, Events/Communities และ Photographer Marketplace ผ่าน entity กลาง ได้แก่ Profile, Vehicle, Media, Place และ Event โดยเริ่มจาก modular monolith และขยายจาก usage จริง

## Architecture Baseline

- Monorepo: pnpm workspace + Turborepo, Node.js 22, TypeScript strict และ pinned lockfile
- Applications: `apps/web` เป็น Next.js UI, `apps/api` เป็น Next.js API-only app ใต้ `/api/v1`, `apps/worker` เป็น long-running Node service
- ก่อนแก้ Next.js code ต้องอ่าน guide ที่เกี่ยวข้องใน `node_modules/next/dist/docs/`
- Shared packages: `database`, `auth`, `storage`, `validation`, `domain`, `ui`, `config`, `types`
- Data: Supabase PostgreSQL/PostGIS/Auth/Realtime, SQL migrations เป็น source of truth, generated Supabase types และ `supabase-js`; ไม่เพิ่ม ORM
- Auth boundary: API รับ Supabase Bearer JWT, ตรวจ authorization server-side, ใช้ CORS allow-list และห้ามส่ง service-role key ไป browser
- Queue: Supabase Queues/`pgmq`; worker ใช้ service role, visibility timeout, retry, archive และ idempotency key
- Media: originals อยู่ private Cloudflare R2, direct upload ด้วย presigned URL, variants สร้างด้วย `sharp`, original download ใช้ short-lived signed URL หลัง authorization
- Map: MapTiler SDK/MapLibre + PostGIS; แยก browser key ต่อ environment และจำกัด allowed origins
- Locale: `th` และ `en` ตั้งแต่ bootstrap; route, metadata, validation message และ UI copy ต้องรองรับทั้งคู่
- Commerce: Opn, THB, PromptPay และ cards/3DS; webhook ต้อง retrieve charge จาก provider ก่อนเปลี่ยน financial state
- Finance: commission เริ่มต้น 10% จาก configurable setting และ snapshot ต่อ order item; ledger เป็น financial source of truth; Commerce Beta ใช้ admin-recorded manual payout
- Deploy: Vercel (`web`, `api`), Railway container (`worker`), Supabase และ Cloudflare R2
- Tests: Vitest, Playwright, Supabase database tests และ API/webhook/queue contract tests

## Milestones and Dependency Flow

```text
Foundation 01-04
  -> Media & Community 05-10
  -> Discovery / Community MVP 11-14
  -> Photographer Beta 15-20
  -> Commerce Beta 21-27
  -> Expansion 28-31
```

- Step 01: repository พร้อม แต่ยังไม่มี business feature
- Step 14: Community MVP ใช้งาน end-to-end ได้
- Step 20: Photographer Beta เลือกรูปและสร้าง cart ได้ แต่ยังไม่รับเงินจริง
- Step 27: Commerce Beta ชำระเงิน, grant entitlement, download original, ledger และ manual payout ได้

## Plan Index

| Step | Plan                                                           | Depends on | Master roadmap |
| ---: | -------------------------------------------------------------- | ---------- | -------------- |
|   01 | [Repository](./01-repository.md)                               | -          | STEP 0-1       |
|   02 | [Supabase Foundation](./02-supabase-foundation.md)             | 01         | STEP 2         |
|   03 | [Authentication](./03-authentication.md)                       | 02         | STEP 3         |
|   04 | [Profiles](./04-profiles.md)                                   | 03         | STEP 3         |
|   05 | [Media Abstraction](./05-media-abstraction.md)                 | 02,04      | STEP 4         |
|   06 | [Direct Image Upload](./06-direct-image-upload.md)             | 05         | STEP 4         |
|   07 | [Image Worker](./07-image-worker.md)                           | 06         | STEP 4         |
|   08 | [Garage](./08-garage.md)                                       | 04,07      | STEP 5         |
|   09 | [Posts](./09-posts.md)                                         | 07,08      | STEP 6         |
|   10 | [Feed](./10-feed.md)                                           | 09         | STEP 6         |
|   11 | [Places/PostGIS](./11-places-postgis.md)                       | 02,09      | STEP 7         |
|   12 | [Explore Map](./12-explore-map.md)                             | 10,11      | STEP 7         |
|   13 | [Events](./13-events.md)                                       | 08,11      | STEP 8         |
|   14 | [Communities](./14-communities.md)                             | 10,13      | STEP 9         |
|   15 | [Photographer Profile](./15-photographer-profile.md)           | 04,14      | STEP 10        |
|   16 | [Photo Albums](./16-photo-albums.md)                           | 13,15      | STEP 11        |
|   17 | [Bulk Upload](./17-bulk-upload.md)                             | 06,16      | STEP 11        |
|   18 | [Watermarked Previews](./18-watermarked-previews.md)           | 07,17      | STEP 12        |
|   19 | [Marketplace UI](./19-photo-marketplace-ui.md)                 | 18         | STEP 13        |
|   20 | [Cart](./20-cart.md)                                           | 19         | STEP 13        |
|   21 | [Orders](./21-orders.md)                                       | 20         | STEP 14        |
|   22 | [Opn Payments](./22-opn-payments.md)                           | 21         | STEP 15        |
|   23 | [Entitlements](./23-photo-entitlements.md)                     | 22         | STEP 16        |
|   24 | [Original Download](./24-original-download.md)                 | 23         | STEP 16        |
|   25 | [Financial Ledger](./25-financial-ledger.md)                   | 22         | STEP 17        |
|   26 | [Seller Earnings](./26-seller-earnings.md)                     | 25         | STEP 18        |
|   27 | [Payouts](./27-payouts.md)                                     | 26         | STEP 18        |
|   28 | [Promotion & Ticketing](./28-promotion-event-ticketing.md)     | 27         | STEP 19-20     |
|   29 | [Storage Plans](./29-photographer-storage-plans.md)            | 27         | STEP 21        |
|   30 | [Photographer Map Spots](./30-photographer-map-spots.md)       | 15,18,29   | STEP 22        |
|   31 | [Business & Parts Discovery](./31-business-parts-discovery.md) | 12,28      | STEP 23        |

## Definition of Done

ทุก step ต้องมี migration ที่ย้อนสร้าง environment ได้, explicit RLS/authorization decision, mobile `th/en` UI, structured errors/logs, tests ตาม risk และ documentation ที่อัปเดตแล้ว ห้ามถือว่าเสร็จหาก lint, typecheck, tests หรือ build ของ workspace ที่เกี่ยวข้องไม่ผ่าน

## Status Workflow

ใช้สถานะ `not_started`, `in_progress`, `blocked`, `done` ที่หัวไฟล์ เปลี่ยนเป็น `done` เมื่อ checklist และ Acceptance Criteria ผ่านทั้งหมด พร้อมเติม `Completed`, commit/PR reference และข้อสังเกตสำหรับ step ถัดไป หาก scope เปลี่ยนให้แก้ plan ก่อน code และบันทึก ADR สำหรับการเปลี่ยน architecture baseline

## Global Guardrails

1. Originals ต้องไม่ออกสู่ client โดยไม่มี entitlement
2. CPU-heavy media work ห้ามอยู่ใน synchronous request
3. Schema ทุกการเปลี่ยนต้องเป็น migration และ sensitive table ต้องมี RLS decision
4. Webhook, worker และ retryable API ต้อง idempotent
5. ห้ามใช้ mutable `balance` เป็น financial truth
6. ทุก feature ต้องใช้งานบน mobile และรองรับ `th/en`
7. AI ranking, wallet, chat, native apps, OCR และ full parts marketplace อยู่นอก MVP
