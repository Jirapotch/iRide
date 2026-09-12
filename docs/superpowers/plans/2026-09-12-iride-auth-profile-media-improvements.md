# iRIDE Auth, Profile Tabs, Supabase Media, and UX Gap Audit

**Spec authority:** The user's approved implementation plan and the attached `iRIDE — Codex Complete Improvement Prompt.md`.

## Global Constraints

- Do not edit Topbar, Header, AppHeader, BottomBar, BottomNav, main-navigation JSX, CSS, tokens, routes, labels, icons, or interactions.
- Preserve existing business logic, protected-route behavior, MapLibre provider, destination-first flows, and existing APIs except the explicitly approved media upload authorization response.
- Reuse existing components and dependencies; do not add a dependency unless the existing stack cannot implement the requirement.
- All behavior changes use strict TDD: add a focused failing test, verify the expected failure, implement the minimum change, and verify green before refactoring.
- Never expose a Supabase service-role key to the browser. The `media` bucket is private.
- Production legacy-media deletion is implemented as a manual dry-run-first workflow only. Do not execute the destructive production apply operation during implementation.
- Existing user changes and `.artifacts/dune-bolt/` in the main checkout are out of scope.

### Task 1: Make Google OAuth first-click PKCE flow reliable

- Replace the Google OAuth Server Action entrypoint with `GET /auth/google/start` and make the login control navigate to it while preserving progressive fallback semantics.
- Sanitize `next` to an internal relative path and preserve both `next` and `intent=profile` across provider start, callback success, callback error, and retry.
- Configure the server Supabase client to append the PKCE flow ID to redirects. Pass a validated `sb_flow_id` to `exchangeCodeForSession` in the callback so concurrent/stale verifier slots cannot collide.
- Do not clear a valid session when OAuth start or callback fails. Preserve HttpOnly, SameSite=Lax, Path=/, and production Secure cookie behavior.
- Add correlation-ID structured logs for `oauth_start`, `code_exchange`, `claims_validation`, and `profile_redirect` without logging codes, tokens, cookies, or personal data.
- Add focused tests for fresh start, retained intent/next, unsafe next rejection, callback retry/error routing, malformed flow ID, and concurrent flow IDs. Verify RED then GREEN.

### Task 2: Make profile tab selection immediate

- Introduce a focused client tab controller for `/users/[username]` that updates the selected tab and `aria-current` immediately, then calls `router.push` inside a transition.
- While the URL/server tab is catching up, hide the old panel and render a panel-shaped Garage or Activities skeleton; keep the profile header stable and mark the panel `aria-busy`.
- Preserve normal Link behavior for modified clicks/new tabs, use push history for Back/Forward, sync state when server props change, and make the latest rapid click win.
- Use scoped styles and existing Ant Design/loading patterns. Preserve keyboard focus-visible behavior and reduce nonessential motion under `prefers-reduced-motion`.
- Add focused component/domain tests proving immediate selection, pending skeleton, server-state synchronization, modifier-click behavior, and latest-click behavior. Verify RED then GREEN.

### Task 3: Add dual-provider Supabase media storage foundations

- Use Supabase CLI help before creating migrations. Add a migration that backfills `media.storage_provider` to `r2`, defaults new rows to `supabase`, and allows `original_object_key` to become null only after cleanup. Mirror it in the TypeORM migration path used by the API.
- Configure an idempotent private `media` bucket for local/production bootstrap with 10 MB size limit and JPEG/PNG/WebP MIME allowlist. Do not add public read policies or expose service credentials.
- Extend `@iride/storage` with a Supabase implementation for signed upload authorization, object download/head/put/delete, and signed download URLs while retaining R2 reads/deletes for legacy rows during cutover.
- Change `POST /media/uploads` response to `{ mediaId, bucketId, objectPath, uploadToken, expiresAt }`; keep completion/status/variant routes compatible and route reads by each row's `storage_provider`.
- Add tests for provider routing, exact upload contract, MIME/size validation, signed URL expiry handling, private reads, and legacy R2 compatibility. Verify RED then GREEN.

### Task 4: Compress uploads and retain variants only

- Add browser-side image preprocessing before authorization/upload: honor orientation; avatar crop 1:1 up to 1024x1024; cover current crop ratio up to 1800px width; vehicle proportional up to 2048px long edge; encode WebP quality 82.
- Upload through the Supabase browser client with `uploadToSignedUrl`, show meaningful progress/pending/error state, and allow retry without duplicate media records.
- Worker must revalidate MIME, byte size, and 40 MP limit, then write WebP quality 80 variants: avatar 256x256 and 512x512; cover 600x200 and 1600x534; vehicle 480x320 and at most 1280x960.
- After all variants are persisted, atomically mark ready and enqueue source deletion. Cleanup retries provider deletion and clears `original_object_key` only after confirmed success, so successful steady state retains variants only.
- Add focused web/API/worker tests covering dimensions, output MIME/quality configuration, retry behavior, atomic ready transition, cleanup failure, and eventual source-key clearing. Verify RED then GREEN.

### Task 5: Add safe legacy-media cutover tooling and documentation

- Add a manual GitHub workflow `media-storage-cutover`, locked to project ref `bgflnssilreepfzxoqpc`, with `dry_run=true` by default. Apply requires exact confirmation `DELETE ALL LEGACY MEDIA` plus matching project ref.
- Produce a manifest artifact for every `storage_provider='r2'` avatar, cover, and vehicle media row, including associations, object keys, variant keys, size, and ETag.
- Delete only manifest-listed R2 objects. Detach/delete database records only for rows whose objects all deleted successfully; retain failed rows and fail the workflow so the same manifest can be retried. Never select or delete Supabase-provider rows.
- Add executable tests for dry-run no-op, confirmation rejection, provider filtering, FK detach order, and partial failure behavior; do not use source-text-only tests.
- Update storage/deployment ADRs, environment examples, and rollout instructions for dual-provider deploy, verification, legacy deletion, zero-R2 check, and later R2 runtime removal. Do not remove R2 runtime support in this task because the approved rollout requires it until production reaches zero legacy rows.

### Task 6: Complete the evidence-based UX/UI and code-quality gap audit

- Re-audit rendered/content code for auth/onboarding, Home/Community/Groups, Activities/Trip/Map, Create, Garage, Profile, Games, and Settings against the attached improvement spec.
- Fix only demonstrated low-risk gaps in content-area loading, empty/error distinction, responsive overflow, 44px targets, semantic names, focus-visible, reduced motion, destination-first feedback, skeleton layout stability, Thai wrapping, and cleanup of pointer/RAF/listener state.
- Preserve the Matcha/Mint direction, MapLibre, Google Maps URL behavior, and existing route flow. Do not touch prohibited navigation components or global theme tokens that affect them.
- Remove deprecated/dead/duplicate code only with concrete references/diagnostics proving it safe. Record uncertain candidates under `Kept for manual review` rather than changing them.
- Add or update focused tests for each behavior actually changed. Verify RED then GREEN.

### Task 7: Integrated verification and final audit

- Run formatting check, lint, typecheck, unit/integration tests, database tests/advisors where the local Supabase environment supports them, and production build. Remove only generated Next cache before rerunning stale-validator failures.
- Run browser interaction and responsive QA at 320, 375, 390, 430, 768, and 1024+ widths for changed flows, including slow loading, rapid clicks, Back/Forward, no image, empty/error, and long Thai/location text.
- Exercise avatar, cover, and vehicle upload with controlled fixtures when local Supabase is available; verify private access, variants, and source cleanup. Do not mutate production data.
- Verify via git diff that Topbar/Bottombar and their supporting files are unchanged.
- Fix regressions with the same test-first process and prepare the final report with PASS/FAIL/NOT AVAILABLE/NOT VERIFIED/BLOCKED statuses and a `Kept for manual review` section.
