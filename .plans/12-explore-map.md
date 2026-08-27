# Step 12 - Explore Map

Status: `not_started`
Dependencies: [Step 10](./10-feed.md), [Step 11](./11-places-postgis.md)

## Goal

สร้าง mobile Explore Map สำหรับ places และ community activity โดยไม่โหลดข้อมูลเกิน viewport

## Architecture Decisions

ใช้ MapTiler SDK/MapLibre client-only dynamic import, origin-restricted public key, bounding-box queries และ marker clustering

## Deliverables

- [ ] map page, filters, cluster markers, selected-marker bottom sheet และ place detail navigation
- [ ] viewport/bounds API สำหรับ place/post summaries
- [ ] graceful list fallback เมื่อ WebGL/geolocation unavailable

## Data/API Contracts

`GET /api/v1/explore?bbox=&zoom=&layers=&cursor=` คืน lightweight GeoJSON/DTO ที่ไม่มี private coordinates; state ที่แชร์ผ่าน URL ได้แก่ center, zoom และ filters

## Implementation Tasks

- [ ] lazy-load map/CSS และ debounce/cancel viewport requests
- [ ] cluster client/server ตาม volume threshold
- [ ] accessible bottom sheet/list และ localized category labels
- [ ] วัด map load, marker count และ API latency

## Security

restrict MapTiler key origins, ห้ามใช้ service token ใน browser และปัด/ซ่อน sensitive coordinates ตาม policy

## Test Plan

- [ ] API bbox/visibility tests
- [ ] component tests สำหรับ filters/selection/fallback
- [ ] Playwright map/list mobile flow และ key-absence error state

## Acceptance Criteria

- [ ] map เปิด place/activity ตาม viewport และไม่ fetch ทั้งประเทศ
- [ ] clustering/bottom sheet usable บน mobile `th/en`
- [ ] ไม่มี private location หรือ MapTiler secret รั่ว

## Out of Scope

Routes, offline maps, events และ photographer layers

## Handoff to Next Step

ส่ง place/map hooks ให้ [Step 13](./13-events.md)
