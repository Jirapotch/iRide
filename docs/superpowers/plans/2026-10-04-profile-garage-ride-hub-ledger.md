# Profile, digital garage and interactive main — execution ledger

## Binding brief

Implement the conversation's approved Profile/Digital Garage plan. Workshops, QR and verification are excluded. Preserve existing kinds (car/motorcycle/bicycle), bilingual UI, existing app navigation and themes. Own profile lives at /profile; public other profiles stay at /users/:username.

The selected visual target is the FIRST displayed image in the latest compact-main set: `.artifacts/profile-garage-design/main-connected-platform.png` (source exec-db9a415d-f959-44c9-9055-d3b17c934a82.png). A single isometric rectangular platform contains five selectable modules. No mountains, forest, editorial hero, long descriptions or giant title. Use native Three.js, short feature labels and mobile controls. User specifically approved this image and mobile support on 2026-10-04.

## Work streams

- Main: procedural platform scene, modes/cameras, functional feature navigation, keyboard/touch controls, rendering lifecycle, fallback and responsive browser verification.
- Garage API: real database migrations, owner summaries, records/documents/archive, transfer state machine and ownership-aware media authorization; shared DTOs and validation; integration/security tests.
- Profile UI: identity-aware routes, own-profile queries, shared compact profile shell, real overview, garage/detail/document/transfer/report forms, loading/errors, bilingual mobile UI and routing tests.
- Integration: review, lint/typecheck/tests/build, database verification where available, responsive interaction/browser checks.

## Rulings

- Work in the existing clean codex branch because all work streams share the authorized workspace. No publish or production migration.
- Current user correction supersedes the original outdoor diorama/hero copy. Use sparse geometric feature stations with no scenic assets. Existing global header/logo stay authoritative.
- Profile and garage use the same restrained layout language; the rejected scenic profile mockups are not implementation targets.
- Existing raster mockups are design references only; scene geometry must be interactive Three.js rather than a rendered-image substitute.

## Progress

- Visual choice resolved; main target available locally and on Superdesign canvas.
- Main implementation complete: native platform, five working destinations, four modes/five camera presets, demand rendering, disposal, reduced motion, lazy fallback and keyboard/touch controls. Trips resolves the existing activities kind filter.
- Own/public profile routing, query-controlled tabs, real overview and AntD Garage/detail/forms/report/archive/transfer UI complete. Shared image uploader preserves ready media on attachment retry; PDFs use the document endpoint.
- Garage API, registered TypeORM migration, shared DTO/schema/database types, private records/documents and atomic transfer guards implemented. Image-media integration and fresh security review complete, with no remaining confirmed finding.
- Root independently ran homepage/navigation/responsive Playwright: 80 passed, one skip (Chromium-specific native CDP touch injection on WebKit). WebKit responsive/navigation coverage passed; native touch gesture passed on Chromium.
- Root independently ran Profile/Garage Playwright: 12 passed across desktop/mobile Chromium, including light/dark, Thai forms, draft preservation, image processing/attachment retry and card actions. These browser runs use local API/auth fixtures and do not certify live Storage integration.
- Visual QA retained in `design-qa.md`, including the source/render paired comparison, corrected P2 findings and disclosed simpler procedural mesh detail.
- No deployment or production migration performed.

## Final verification — 2026-10-05

- Workspace lint, typecheck and production build: passed across all nine packages. Changed-source Prettier check and `git diff --check`: passed.
- Workspace tests: 488 Vitest test cases and nine media-cutover script tests passed (497 total). This includes API 246, web 157 and validation 39. Existing mocked-Next-Link `prefetch` warnings remain in Knowledge test output; production preview has no page errors.
- Browser suites: 92 passed, one Chromium-specific touch-injection skip on WebKit. Homepage suite spans desktop Chromium, mobile Chromium and mobile WebKit; Profile suite spans desktop/mobile Chromium. Local fixtures cover the UI contract and failure retries.
- Root independently executed the final isolated PostgreSQL harness: all 75 assertions passed using the actual migration, legacy processing/source-cleanup constraints and transfer/RLS SQL tests. Test-file SHA-256: `000FBFAE37AEC50A15EEC6584FC931E54E86AB048FD0EA14EFC5770B05ABD27C`.
- Final built homepage preview at `http://127.0.0.1:3000/`: scene ready and no page errors/horizontal overflow at 1440, 390 and 360px. Screenshots: `.artifacts/profile-garage-design/final-main-1440.png`, `final-main-390.png`, `final-main-360.png`.
- Local build preview remains available on port 3000. Profile's new persistent Garage features require applying the registered migration in an authorized database environment; production remains unchanged.
- Test-only mock services on 3100/3101/54321 were stopped after verification; only the delivered build preview on 3000 remains.

## Homepage browser-comment revision — 2026-10-05

- Removed the camera picker, scene mode controls and external duplicate feature section, as requested in comments 1, 2 and 4.
- Added Knowledge as the sixth selectable 3D station (open book, layered pages, bookmark, desk lamp), linked to `/knowledge`; rearranged the platform into two rows and mobile controls into three columns/two rows. All selection, Open, reset and zoom controls remain inside the frame.
- Repositioned Activities plaque away from the motorcycle; refreshed the actual scene's fallback poster. Current responsive captures are `main-desktop-1440.png`, `main-1024.png`, `main-390.png`, `main-360.png` under `.artifacts/profile-garage-design`.
- Web typecheck, lint, focused unit tests (six cases), updated browser-spec lint and production web build passed. Final Chromium/mobile Chromium/mobile WebKit homepage run: 56 passed, one native CDP touch skip on WebKit. Log: `.artifacts/profile-garage-design/comments-browser.log`.
- Initial browser run exposed stale test assumptions: touch coordinates landed on the moved plaque, and a downstream Activities filter assertion depended on the unavailable local API. Gesture checks now derive coordinates from the canvas; hub navigation checks assert the actual destination URL. Existing trip-filter unit tests and prior fixture-based integration evidence remain separately recorded.
- Manually verified the Knowledge station's Open action reaches the existing Knowledge page in the user's in-app browser, then returned to the refreshed homepage preview.

## Validation limits and operational notes

- Native Supabase database tests and database type regeneration require the local Linux Docker service, which is unavailable on this host. No remote/production fallback was used. A reproducible isolated PostgreSQL (PGlite) harness exercises the actual migration and SQL assertions against a minimal auth/RLS baseline; it does not substitute for native Storage integration or independent concurrent database connections.
- Sale report uses browser print with real vehicle/history data, selected image documents and secured PDF links. It does not merge uploaded PDF pages into the printed document.
- The selected design references were saved on the existing Superdesign canvas. Automatic approval review rejected an optional additional export of implementation screenshots; those screenshots remain local and the rejected export was not retried.
- Production migration/deployment remain separate delivery steps after local verification.
