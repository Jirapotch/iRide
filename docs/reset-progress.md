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

- Garage availability is being repaired by additive provisioning: `public.garage_vehicles`, `garage_service_records`, and `garage_vehicle_photos` coexist with untouched legacy tables. The v2 schema marker keeps the previously deployed v1 repository blocked until the matching code is released. The full destructive cutover tool refuses an already-provisioned Garage to protect new records; legacy retirement remains a separate pending operation.
- The additive SQL regression reproduces the original table-name collision and now passes while preserving legacy vehicle data. Updated `pnpm check` passes 37 web tests, 14 operational/PostgreSQL tests, lint, typecheck and production build.
- The isolated baseline was applied to the approved hosted Supabase project and released on main `45130b1a`. Live vehicle/service create, read, update and delete passed through the public production API; a separate Chrome refresh showed the saved vehicle, mileage, service and correct total. Verification rows were removed. Legacy vehicle structure fingerprint is unchanged. Linux CI passed all checks including Playwright 24/24 and pgTAP 12/12: run `38195547998`.
- OAuth configuration is now created by the owner. The local Web OAuth client is prepared; credentials are saved only in ignored `.env.local`. Public Thai/English privacy and usage pages are added for Google production branding. Picker, owner consent, live Drive uploads and legacy cleanup remain pending.

- Existing Drive samples are read-only display assets, separate from uploaded vehicle photos. They will not create fake vehicle records in the empty Garage.
- Runtime Drive credentials must be established by the owner's one-time OAuth setup; the Codex connector is not a deployed runtime credential.
- Local setup uses Supabase; destructive production cleanup requires a successful full backup and new runtime readiness first.

## Verification and review

- Web unit suite: 37 tests passed, including Drive quota/revoked access, parent ownership, ambiguous upload, compensation failure and the old-schema access gate.
- PostgreSQL baseline integration passed on PGlite: actual SQL, grants/RLS, cover ownership, totals over 1000 rows and upload/delete locking.
- Main Playwright suite passed 24/24 across desktop Chrome, Android Chrome, iPhone WebKit and iPad Mini WebKit: CRUD/photo UI with mocked API, supplied images, model picking with touch/mouse, keyboard/WebGL fallback, English preference and start/stop interactions. Hub overflow/picking was checked again after Ant Design layout adjustments.
- `pnpm check` passed: lint, typecheck, 37 web tests + 13 operational/PostgreSQL tests and production build. Both PostgreSQL integration tests execute real SQL, including representative restrictive legacy ownership references.
- Independent read-only review completed. Four Important cutover findings were reproduced with failing tests and corrected: dependency deletion before Auth accounts; preview staging remains accessible while production pauses; transactional completion marker with atomic journal; old deployment retirement plus signed-upload draining/stable manifest before final backup.
- Legacy database objects and storage remain unchanged; the isolated Garage baseline is now installed. Docker-backed local Supabase is unavailable, pgTAP is verified in CI, and live Drive smoke tests, backup restore rehearsal and legacy cutover remain pending prerequisites.
- Main now contains the reset (`70910b61`) and main verification trigger (`67610aa6`), pushed to GitHub at the user's explicit request. A production build is live at `https://iride-gent.vercel.app/`; the hosted database and files remain unchanged.
- Live desktop/mobile checks reproduced a Garage hydration mismatch caused by eagerly rendered Ant Design modal portals. The browser regression failed before removing `forceRender`, then the complete 24-test production-build browser suite passed with hydration errors checked.
- Initial Linux CI passed 22/24 browser tests. Trace evidence showed software WebGL pointer scans taking roughly 400 ms per action and exceeding the original total 30-second deadline; the three-model test now allows 120 seconds with all assertions preserved. The revised hosted CI result is pending.
- Production Garage persistence, owner Drive OAuth, live photo lifecycle, verified hosted backup and legacy retirement remain pending credentials. Server `SUPABASE_URL` is configured for the approved existing project; the schema-version gate prevents using the legacy vehicle tables.
- Linux CI now passes all 24 browser journeys. The Docker Supabase stack starts and resets successfully; its first pgTAP run exposed three incorrect two-argument `has_table` checks (interpreted as table/description). They now use explicit schema/table/description; the remaining nine database assertions already passed.
- Portable PostgreSQL 17.11 `pg_dump` and `pg_restore` are prepared under ignored `.tmp/postgres17` and configured in ignored `.env.cutover.local`; hosted backup still requires the owner's database connection and administrative credentials.

Ruling: Use portable PostgreSQL integration locally because Docker is unavailable; keep pgTAP in CI and require a live cloud smoke test before acceptance — cost: pgTAP and cloud behavior remain unverified locally.
Ruling: Stage through a preview with explicit production credentials and drain old upload grants for 2h10m before final backup — cost: a maintenance window while the old app is unavailable.
Final: minor (deferred): concurrent first uploads may create two app-owned folders with the same vehicle UUID; images remain linked and scoped to that vehicle, but canonical folder reservation is deferred.
