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
- Production remains unchanged. Docker-backed local Supabase/pgTAP, live Drive smoke tests, backup restore rehearsal and hosted cutover are pending prerequisites.

Ruling: Use portable PostgreSQL integration locally because Docker is unavailable; keep pgTAP in CI and require a live cloud smoke test before acceptance — cost: pgTAP and cloud behavior remain unverified locally.
Ruling: Stage through a preview with explicit production credentials and drain old upload grants for 2h10m before final backup — cost: a maintenance window while the old app is unavailable.
Final: minor (deferred): concurrent first uploads may create two app-owned folders with the same vehicle UUID; images remain linked and scoped to that vehicle, but canonical folder reservation is deferred.
