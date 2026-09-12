# ADR 0010: Private Supabase media with variants-only retention

- Status: Accepted
- Date: 2026-09-12
- Supersedes: ADR 0003 for new media

New uploads use the private Supabase `media` bucket. The API returns a scoped signed-upload token after ownership and input validation. The browser produces WebP quality 82 and uploads with `uploadToSignedUrl`; service-role credentials stay in API/worker environments. Authorized reads continue through the existing media API and short-lived signed download URLs. There is no public-read policy.

The Sharp worker independently validates MIME, bytes and pixels and produces quality-80 WebP thumbnail/preview variants. Ready state, variants and source-cleanup enqueue commit atomically. Cleanup waits two hours to outlive signed-upload replay, removes the source, then clears its database key. Failure preserves the key and queue retry. Steady state retains variants only; paid Supabase Image Transformations are unused.

Existing rows are backfilled as `r2`; new rows default to `supabase`. Reads, processing and cleanup route by the persisted provider, and legacy queue messages without a provider mean R2. R2 runtime dependencies and credentials remain until production has completed cutover and proven zero legacy rows and no R2 queue work.

The user chose deletion rather than migration of legacy avatar, cover and vehicle images. The manual workflow exports an immutable metadata manifest before deleting only its exact R2 keys. Successful object deletion precedes transactional FK detachment and row deletion. Partial failures keep database records for retry from the same manifest. The manifest is audit evidence, not a binary backup; deleted legacy images cannot be recovered. See the [rollout runbook](../media-storage-rollout.md).
