# Media storage rollout

This is a manual production procedure for project `bgflnssilreepfzxoqpc`. Implementation does not execute it. The manifest contains ownership/association metadata and must remain restricted to repository operators. It contains no image binaries; successful R2 deletion is irreversible.

## Deploy and verify

1. Run local migrations, database tests/advisors, type generation checks, lint, typecheck, tests and production builds. When Docker is unavailable, do not treat authored SQL tests or in-memory checks as full Supabase validation.
2. Pause Cron queue drains and optional continuous workers while deploying the storage/retention migrations, API and workers together. Keep the R2 credentials configured. The migrations provision a private `media` bucket with a 10 MiB JPEG/PNG/WebP limit. They do not delete legacy media.
3. Deploy web upload/OAuth changes, then resume updated workers. Smoke-test Google first-click/retry and new avatar, cover and vehicle uploads. Confirm dimensions/WebP, denied unauthorized reads, 120-second signed downloads, processing retries and source-key clearing after the two-hour cleanup delay. New rows must show `storage_provider = 'supabase'`.
4. Before destructive cutover, ensure old API deployments cannot issue R2 tokens, wait at least two hours after the last legacy upload authorization, drain existing R2 processing/cleanup jobs, and pause drains during cutover. Do not run other R2 writers or media deletion maintenance concurrently. New Supabase uploads can continue. The tool locks each media row while checking storage and deleting metadata; stopping legacy writers also prevents external object replacement races.

## Manifest and apply

The `media-storage-cutover` GitHub workflow is `workflow_dispatch` only and uses the `production` environment. Configure required environment reviewers and restrict deployment branches to the reviewed release branch before using it. It never runs from deploy or migration. Concurrency serializes cutover runs.

Required production environment secrets: `SUPABASE_DB_PASSWORD`, `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET`. The checked-in Supabase CA bundle verifies TLS. The script fixes the pooler host, database username/project and database name in code; it does not accept arbitrary database URLs. Keep runtime R2 secrets until the final removal release.

1. Dispatch with `dry_run=true` (default) and `confirm_project_ref=bgflnssilreepfzxoqpc`. Leave `manifest_run_id` empty to export. The script reads only R2 avatar/cover/vehicle rows, gathers profile/vehicle associations and variants, and HEADs every exact canonical key for size and ETag. Missing objects are explicitly recorded. Any other storage failure stops export. No database/object writes occur in dry-run.
2. Review/download `legacy-media-manifest` and its SHA-256 file. The artifact is immutable in that workflow run and retained for 90 days. Preserve it securely beyond retention if needed. Inspect media counts, ownership, associations, object keys, declared bytes and actual size/ETag. It is not a backup.
3. Dispatch apply with `dry_run=false`, the exact project ref, `confirmation=DELETE ALL LEGACY MEDIA`, and the reviewed dry-run's numeric `manifest_run_id`. A blank run ID can generate a fresh manifest, but always prefer the reviewed artifact. The workflow validates and uploads the exact manifest in the current run before any deletion; upload failure prevents apply.
4. Apply rejects provider, owner, purpose, path and ETag drift. It deletes batches of only the manifest keys (at most source plus two variants per row), checks every S3 result and then HEAD-verifies absence. It nulls matching profile avatar/cover FKs, removes vehicle associations and variants, and deletes the still-R2 media row in a transaction. It never changes vehicle records or newly selected Supabase profile images.
5. On any failure the workflow exits nonzero and saves `legacy-media-cutover-result`. Successful rows remain deleted; failed rows retain database records. Re-run with the **same manifest run ID**. Already-missing objects are safe to retry; absent database rows are skipped only when every listed object is also absent. Changed ETags/keys/providers or missing rows with surviving objects require investigation, not a newly generated manifest that hides the discrepancy. A failed database commit may leave objects gone and the row present; retry completes metadata cleanup.

## Close out

Run this read-only query and save the result with release evidence:

```sql
select storage_provider, purpose, count(*)
from public.media
group by storage_provider, purpose
order by storage_provider, purpose;
```

All R2 counts must be zero. Verify no pending/archived retryable R2 processing/cleanup jobs remain, resume queue drains, and repeat profile/Garage/private-access smoke tests. Only then make a separate release to remove R2 adapters, routing fallback, AWS dependencies, runtime R2 environment variables/secrets, and update the ADR/deployment docs. This branch deliberately retains them until that evidence exists.

The standalone commands are `node scripts/media-storage-cutover.mjs export|validate|apply`. They use the same workflow environment variables, require exact confirmation before network access, and read/write the fixed `cutover-manifest/` location without overwriting existing files. Use the workflow for production so artifact preservation and manual approval happen before apply.
