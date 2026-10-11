# Production reset runbook

Target: Supabase `bgflnssilreepfzxoqpc`, Vercel `iride` and retired `iride-api`.
The application branch does not reset production by itself.

## Prepare

1. Run `pnpm check` and `pnpm test:e2e`. Run `pnpm db:test` on a Docker-enabled machine or CI. Review the reset changes before starting.
2. Run the owner's local `pnpm drive:setup` and establish lasting `drive.file` access to folder `1mFCIBIJHkQjYn4y_gg0GRkiELEatHMf0`. Neither existing destination files nor the separate sample folder will be changed.
3. Stage this revision as a **preview** in the existing Vercel web project. The tool rejects a production candidate before maintenance because project pause blocks production deployments. Use Node 24, Next.js, root directory `apps/web`, workspace source files enabled and `pnpm install --frozen-lockfile`. Supply the intended production values for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the four runtime Drive variables to this branch's preview deployment. The preview must remain accessible to the reset tool while production is paused. See Vercel's [promotion flow](https://vercel.com/docs/deployments/promote-preview-to-production).
4. Put the operational variables from `.env.example` in ignored `.env.cutover.local`. `MIGRATION_DATABASE_URL` must be the direct connection or **session** pooler connection for the approved project, including its encoded password. Supply PostgreSQL 17+ `pg_dump` and `pg_restore` executable paths. The script enforces TLS certificate validation with the bundled Supabase CA.
5. Set `NEW_DEPLOYMENT_ID` to the staged deployment ID and set its protection bypass secret if protected. Backups must be written under this checkout's ignored `backups/` folder; keep a second copy outside the checkout.
6. Temporarily disconnect Git auto-deployment for both Vercel projects under Settings → Git. The preflight verifies no repository link remains. Freeze other deployers and direct storage writers during the reset. Reconnect the web project only after the repository's production branch contains this reset revision. The reset tool removes previous deployments during maintenance, so they cannot keep issuing new upload tokens.

## Preflight and apply

```powershell
pnpm db:cutover --project-ref bgflnssilreepfzxoqpc
pnpm db:cutover --apply --project-ref bgflnssilreepfzxoqpc --backup-dir backups/reset-2026-10-12
```

The first command is read-only. It verifies the target, the legacy schema, the staged deployment/configuration, the owner's Drive permission, Supabase admin access, storage manifest and backup executables. Missing credentials stop before any changes.

Apply performs these phases, in order:

1. Export a custom-format database dump and all Supabase/R2 files; read back files and verify SHA-256 checksums and dump inventory.
2. Pause both old Vercel production projects, disable signup/anonymous Auth creation, stop `iride-drain-jobs` and revoke direct old application access from browser roles.
3. Drain previously issued upload authorizations. Supabase signed upload URLs are valid for [two hours](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl); the old R2 code used five minutes. The tool records when writers stopped, refuses to proceed for **2 hours 10 minutes**, checks for reappearing legacy deployments and active database writes, then accepts only a stable storage manifest. Resume the same run after the deadline shown by the tool; no files or accounts have been deleted during this waiting period.
4. Export a second, final database/file backup after writers and uploads are stopped. The manifest must remain unchanged throughout the backup.
5. Delete only the Supabase files/buckets and R2 keys in the final manifest, checking current contents against their backups. No database cleanup occurs if any file cleanup fails.
6. In one SQL transaction, remove the application's `public`/`private` objects, legacy queues/cron and migration history; apply the fresh Garage baseline and a run-bound completion marker. Extension-owned objects and managed Supabase schemas remain. Remove Auth accounts through the admin API **after** restrictive application foreign keys have been removed.
7. Verify the new runtime, then promote and resume the web project.
8. Save old API project metadata, retire the API project, and remove previous web deployments so their old server routes cannot write again. Git history remains the code recovery source.

The reset tool never calls Drive deletion or sharing endpoints. Normal Garage photo deletion is separately restricted to app-created files.

## Retry and recovery

Every completed phase is recorded atomically in `backups/<run>/journal.json`. A run-bound marker on the new vehicle table recovers the reset phase if SQL committed but the filesystem journal update failed. Fix a failed phase and resume the same run:

```powershell
pnpm db:cutover --apply --resume --project-ref bgflnssilreepfzxoqpc --backup-dir backups/reset-2026-10-12
```

Keep legacy writers disabled during a partial cutover. Never restart from an empty journal after the baseline was applied. The tool refuses to reset an already-fresh Garage. A failed SQL reset rolls back its application schema changes; deleted files/accounts require recovery from the final backup if the release is abandoned. `initial` preserves pre-maintenance state; `final` is the authoritative data/file snapshot for recovery.

Validate live multi-device Garage CRUD, multiple image uploads, cover changes, image previews and deletion before marking production accepted. Also check old API URLs, signup, removed buckets, queues and cron. Record results in `docs/reset-progress.md`; do not label mocked browser tests as live Drive verification.
