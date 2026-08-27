# ADR 0003: Private Cloudflare R2 media

- Status: Accepted
- Date: 2026-08-27

## Decision

Store original media in private Cloudflare R2. Clients upload and download only through short-lived signed URLs issued after authorization. CPU-heavy image processing runs in the worker, not synchronous web/API requests.

## Consequences

R2 credentials remain server-only. Public DTOs must never expose original object URLs, and future media operations require explicit entitlement checks and idempotent processing.
