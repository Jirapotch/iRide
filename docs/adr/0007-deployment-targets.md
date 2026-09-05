# ADR 0007: Deployment targets

- Status: Accepted
- Date: 2026-08-27

## Decision

Deploy `apps/web` and `apps/api` as separate Node 24 Vercel projects, data/auth/pgmq/Cron to Supabase, and private media to Cloudflare R2. Supabase Cron invokes the protected bounded Nest job endpoint every minute; no paid always-on worker host is required.

## Consequences

Each application owns its environment variables and health probe. Shared packages remain portable, the optional continuous worker honors termination signals, and production migrations use the direct database URL in a separately approved workflow.
