# ADR 0002: Supabase platform without an ORM

- Status: Accepted
- Date: 2026-08-27

## Decision

Use Supabase PostgreSQL, PostGIS, Auth, Realtime, and generated `supabase-js` types. Versioned SQL migrations are the schema source of truth; no ORM or ORM migrations will be added.

Browser access uses publishable credentials and RLS. Service-role credentials are restricted to API and worker runtimes.

## Consequences

Step 02 must make local and staging databases reproducible from migrations and seed files, generate types, and test grants/RLS explicitly.
