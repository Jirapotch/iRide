# Step 14 - Communities

Status: `not_started`
Dependencies: [Step 10](./10-feed.md), [Step 13](./13-events.md)

## Goal

จบ Community MVP ด้วย persistent groups, roles, community feed และ events

## Architecture Decisions

membership roles `owner|admin|moderator|member`, status `pending|active|banned|left`; public join ได้ทันที ส่วน private ต้อง approval

## Deliverables

- [ ] communities/community_members migrations, RLS และ role constraints
- [ ] CRUD/join/leave/member administration APIs
- [ ] profile, feed และ event pages บน mobile `th/en`
- [ ] Community MVP end-to-end acceptance suite

## Data/API Contracts

`communities(id,owner_id,name,slug,description,avatar_media_id,cover_media_id,visibility,timestamps)`; membership mutations และ community-scoped feed/events endpoints

## Implementation Tasks

- [ ] atomic ownership/member creation และ safe ownership transfer rule
- [ ] role capability matrix ใน domain package
- [ ] filter community posts/events ตาม membership/visibility
- [ ] prevent last owner leave และ audit moderation actions

## Security

RLS ต้อง mirror capability matrix; private community metadata/content ไม่รั่วผ่าน counts, feed หรือ search

## Test Plan

- [ ] role/RLS/join/leave/ban/last-owner tests
- [ ] community feed/event API integration
- [ ] Playwright Community MVP: auth -> profile -> garage -> post -> map -> event -> community

## Acceptance Criteria

- [ ] public/private membership และ admin permissions ถูกต้อง
- [ ] community feed/events ใช้ shared domains โดยไม่ duplicate model
- [ ] Community MVP checklist ใน README ผ่านบน mobile `th/en`

## Out of Scope

Chat, paid membership, advanced moderation และ marketplace

## Handoff to Next Step

freeze Community MVP contracts แล้วเริ่ม [Step 15](./15-photographer-profile.md)
