# Step 03 - Google OAuth Authentication

Status: `in_progress`
Dependencies: [Step 02](./02-supabase-foundation.md)

## Goal

ให้ผู้ใช้ login/logout ด้วย Google OAuth พร้อม session ที่ปลอดภัยใน web/API

## Architecture Decisions

Supabase Auth เป็น identity provider; web ใช้ SSR cookie session ผ่าน `@supabase/ssr` ส่วน API รับ Bearer JWT และตรวจ signature ด้วย `getClaims(token)` ทุก request รองรับ locale `th/en` ใน callback/error flow โดยไม่ใช้ `getSession()` ตัดสิน authorization Email/password auth ถูกเลื่อนไปหลัง Step 03

## Deliverables

- [x] Google sign-in/sign-out UI ภาษาไทยและอังกฤษพร้อม mobile loading/error states
- [x] PKCE auth callback, SSR cookie refresh, protected-route guard และ redirect sanitization
- [x] API Bearer authentication/context, normalized auth errors และ `GET /api/v1/auth/me`
- [x] server-side account page ที่ forward access token ไป API โดยไม่เผย token ให้ Client Component

## Data/API Contracts

API context มี `{ userId: string; accessTokenClaims: SupabaseAccessTokenClaims }` และ error codes `AUTH_REQUIRED | AUTH_INVALID_TOKEN | AUTH_PROVIDER_ERROR` endpoint `GET /api/v1/auth/me` คืนเฉพาะ `{ data: { userId } }` และ auth callback routes ห้ามรับ arbitrary external redirect

## Implementation Tasks

- [x] เปิด Google provider, ปิด Email provider และกำหนด callback `th/en` แบบ exact สำหรับ local/production
- [x] ทำ mobile UI, loading/error states และข้อความภาษาไทย/อังกฤษ
- [x] refresh expired sessions server-side และ clear เฉพาะ Supabase auth cookies เมื่อ session เสีย
- [x] ตรวจ JWT signature, issuer, `aud=authenticated`, UUID subject และ expiry โดยไม่ trust client user ID
- [x] เพิ่ม CORS allow-list และ `OPTIONS` สำหรับ API

## Security

ใช้ `httpOnly`, `sameSite=lax`, `secure` เฉพาะ production, ใช้ Supabase rate limits ที่มีอยู่, generic provider errors และห้าม log authorization headers, cookies, codes หรือ tokens Redirect sanitizer ปฏิเสธ absolute/protocol-relative URLs, backslash, control/encoded control characters และ locale ที่ไม่ตรง flow

## Production Configuration

- Web origin และ Site URL: `https://iride-ecru.vercel.app`
- Supabase project: `bgflnssilreepfzxoqpc`
- App callbacks: exact `/th/auth/callback` และ `/en/auth/callback` สำหรับ local/production
- Google Console callback: `https://bgflnssilreepfzxoqpc.supabase.co/auth/v1/callback`
- ไม่อนุญาต Vercel preview URLs จนกว่าจะมี staging environment
- Google client secret ต้องอยู่ใน environment/config เท่านั้นและห้าม commit หรือแสดงใน log

## Test Plan

- [x] unit tests: redirect sanitizer, locale, Bearer parsing, normalized errors และ claim validation
- [x] web integration: OAuth start/callback, cookie refresh/clear, protected redirect และ logout
- [x] API integration: missing/invalid/valid ES256 token, CORS และ response data minimization
- [x] Playwright mobile: Google flow ผ่าน test-only Supabase mock, account/API, sanitized `next` และ logout ทั้ง `th/en`
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`
- [x] Supabase database advisors (`--fail-on error`)
- [ ] production smoke: callback allow-list, Google consent/login, protected account/API และ logout

## Acceptance Criteria

- [x] Google-authenticated user เข้า protected route/API ได้และ unauthenticated user ถูกปฏิเสธใน automated integration/E2E
- [x] session refresh ทำงานข้าม web/API โดยไม่เผย service role, raw token, full claims หรือ user metadata
- [x] auth flow ผ่าน mobile automation ทั้งสองภาษา
- [ ] production smoke ผ่านบน `https://iride-ecru.vercel.app`

## Out of Scope

Email/password signup, email verification, password reset, profile fields, social login อื่น, MFA และ account deletion

## Deferred Work

Email/password signup, verification, password login และ password reset จะกลับมาทำเมื่อ production SMTP พร้อม โดยไม่เป็น Acceptance Criteria ของ Step 03 รอบนี้

## Handoff to Next Step

ส่ง authenticated user context ให้ [Step 04](./04-profiles.md)
