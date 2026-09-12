# ADR 0007: Deployment targets

- Status: Accepted
- Date: 2026-08-27

## Decision

Deploy `apps/web` and `apps/api` as separate Node 24 Vercel projects, data/auth/pgmq/Cron and new private media to Supabase. Retain Cloudflare R2 for legacy media reads/deletes until the [manual storage cutover](../media-storage-rollout.md) proves zero legacy rows. Supabase Cron invokes the protected bounded Nest job endpoint every minute; no paid always-on worker host is required.

## Consequences

Each application owns its environment variables and health probe. Shared packages remain portable, the optional continuous worker honors termination signals, and production migrations use the direct database URL in a separately approved workflow.
