# ADR 0004: Supabase Queues and pgmq

- Status: Accepted
- Date: 2026-08-27

## Decision

Use Supabase Queues backed by `pgmq` for durable asynchronous work. Only trusted API/worker code may enqueue or consume jobs. Consumers use versioned payloads, visibility timeouts, bounded retries, archival, and idempotency keys.

## Consequences

Browser roles receive no queue privileges. Step 02 defines queue helpers and grants; later workers must archive terminal jobs and make retries safe.
