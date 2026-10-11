# iRide reset implementation

Approved plan: reset into one public Next.js garage, retain engine simulator and traffic game, use Ant Design and Three.js, upload car photos to Google Drive.

## Tasks

- [x] Replace old app and tooling; preserve playable game and engine simulator.
- [x] Implement Garage data validation, SQL baseline, repository and API.
- [x] Implement Drive adapter, photo lifecycle, local OAuth/Picker setup.
- [x] Implement fullscreen 3D hub and Ant Design screens.
- [x] Display the two user-provided Drive sample images.
- [x] Implement backup/reset/deployment tooling and regression coverage (live execution pending).
- [x] Run checks, browser verification and independent final review.
- [ ] Cut over production when new runtime and backup prerequisites are ready.

## Decisions

- Existing Drive samples are read-only display assets, separate from uploaded vehicle photos. They will not create fake vehicle records in the empty Garage.
- Runtime Drive credentials must be established by the owner's one-time OAuth setup; the Codex connector is not a deployed runtime credential.
- Local setup uses Supabase; destructive production cleanup requires a successful full backup and new runtime readiness first.

## Verification and review

- Web unit suite: 37 tests passed, including Drive quota/revoked access, parent ownership, ambiguous upload, compensation failure and the old-schema access gate.
- PostgreSQL baseline integration passed on PGlite: actual SQL, grants/RLS, cover ownership, totals over 1000 rows and upload/delete locking.
- Main Playwright suite passed 24/24 across desktop Chrome, Android Chrome, iPhone WebKit and iPad Mini WebKit: CRUD/photo UI with mocked API, supplied images, model picking with touch/mouse, keyboard/WebGL fallback, English preference and start/stop interactions. Hub overflow/picking was checked again after Ant Design layout adjustments.
- `pnpm check` passed: lint, typecheck, 37 web tests + 13 operational/PostgreSQL tests and production build. Both PostgreSQL integration tests execute real SQL, including representative restrictive legacy ownership references.
- Independent read-only review completed. Four Important cutover findings were reproduced with failing tests and corrected: dependency deletion before Auth accounts; preview staging remains accessible while production pauses; transactional completion marker with atomic journal; old deployment retirement plus signed-upload draining/stable manifest before final backup.
- Hosted database and storage remain unchanged. Docker-backed local Supabase/pgTAP, live Drive smoke tests, backup restore rehearsal and hosted cutover are pending prerequisites.
- Main now contains the reset (`70910b61`) and main verification trigger (`67610aa6`), pushed to GitHub at the user's explicit request. A production build is live at `https://iride-gent.vercel.app/`; the hosted database and files remain unchanged.
- Live desktop/mobile checks reproduced a Garage hydration mismatch caused by eagerly rendered Ant Design modal portals. The browser regression failed before removing `forceRender`, then the complete 24-test production-build browser suite passed with hydration errors checked.
- Initial Linux CI passed 22/24 browser tests. Trace evidence showed software WebGL pointer scans taking roughly 400 ms per action and exceeding the original total 30-second deadline; the three-model test now allows 120 seconds with all assertions preserved. The revised hosted CI result is pending.
- Production Garage persistence, owner Drive OAuth, live photo lifecycle, verified hosted backup and legacy retirement remain pending credentials. Server `SUPABASE_URL` is configured for the approved existing project; the schema-version gate prevents using the legacy vehicle tables.
- Linux CI now passes all 24 browser journeys. The Docker Supabase stack starts and resets successfully; its first pgTAP run exposed three incorrect two-argument `has_table` checks (interpreted as table/description). They now use explicit schema/table/description; the remaining nine database assertions already passed.
- Portable PostgreSQL 17.11 `pg_dump` and `pg_restore` are prepared under ignored `.tmp/postgres17` and configured in ignored `.env.cutover.local`; hosted backup still requires the owner's database connection and administrative credentials.

Ruling: Use portable PostgreSQL integration locally because Docker is unavailable; keep pgTAP in CI and require a live cloud smoke test before acceptance — cost: pgTAP and cloud behavior remain unverified locally.
Ruling: Stage through a preview with explicit production credentials and drain old upload grants for 2h10m before final backup — cost: a maintenance window while the old app is unavailable.
Final: minor (deferred): concurrent first uploads may create two app-owned folders with the same vehicle UUID; images remain linked and scoped to that vehicle, but canonical folder reservation is deferred.
