# ADR 0007: Deployment targets

- Status: Accepted
- Date: 2026-08-27

## Decision

Deploy `apps/web` and `apps/api` as separate Vercel projects, the Node 22 worker container to Railway, data/auth/queues to Supabase, and private media to Cloudflare R2.

## Consequences

Each application owns its environment variables and health probe. Shared packages must remain portable across these runtimes, and worker shutdown must honor container termination signals.
