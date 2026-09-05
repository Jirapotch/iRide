# iRide

## Bootstrap the first administrator

After applying the account-access migration, promote the intended profile with a server-only service-role environment. The command defaults to `jirapotch`; pass a username to target a different existing profile. It never creates a profile or accepts an invented UUID.

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm admin:promote [username]
```

Administrative state changes are tokenized. If a transition remains pending for at least 15 minutes, an active administrator can safely reconcile it with `PATCH /api/v1/admin/users/:id` and `{ "action": "recover" }`. Recovery first restores the target's Auth ban state to the recorded prior access state, then atomically rolls the database transition back only when its exact token is still current; a newer transition is never overwritten.

iRide is a mobile-first, bilingual community for people who love cars and the stories behind every drive. This repository currently contains the platform foundation only; business features begin in Step 02 of the implementation plans.

## Repository layout

- `apps/web` — Next.js 16 App Router UI on port 3000
- `apps/api` — NestJS API on port 3001, Vercel adapter, and optional worker process on port 3002
- `packages/*` — shared auth, config, database, domain, storage, types, and validation boundaries
- `.plans` — version-controlled implementation roadmap
- `docs/adr` — accepted architecture decisions

## Prerequisites

- Node.js 24 (the repository includes `.nvmrc` and `.node-version`)
- Corepack with pnpm 11.19.0
- Docker-compatible runtime with at least 7 GB available for the local Supabase stack

The production images and Vercel projects use Node 24. Use Node 24 before treating a local verification as release-equivalent.

## Local setup

```bash
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
```

Copy `.env.example` to the repository-root `.env.local` and replace placeholders. The root `pnpm dev` command loads this file before Turbo starts the applications. Values beginning with `NEXT_PUBLIC_` may be included in browser bundles. Supabase service-role, Cloudflare R2, and Opn values are server-only and must never use a `NEXT_PUBLIC_` prefix.

Start all applications:

```bash
pnpm dev
```

Open `http://localhost:3000`. The web app detects `th/en` from the browser and stores an explicit language choice in the HttpOnly `iride-locale` cookie without adding a locale prefix to the URL. Health probes are available at:

- `http://localhost:3000/api/health` — web
- `http://localhost:3001/api/health` — API
- `http://localhost:3002/health` — worker

Run the optional continuous worker with `pnpm --filter @iride/api dev:worker`. It validates all server credentials at startup. Production uses Supabase Cron to call the protected bounded drain endpoint instead of requiring a paid always-on worker host.

## Quality commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm check
```

`pnpm check` runs lint, typecheck, unit tests, and production builds. Playwright is separate because it starts local web/API servers and requires a browser installed with `pnpm exec playwright install chromium`. Run both suites locally before merging changes.

## Supabase development

SQL under `supabase/migrations` is the frozen historical baseline. New schema changes are TypeORM migrations under `apps/api/src/database/migrations`. The local stack uses PostgreSQL 17 with Auth, Realtime, PostGIS, pgmq queues, and deny-by-default database privileges. Start and verify it with:

```bash
pnpm db:start
pnpm db:reset
pnpm db:test
pnpm db:types
pnpm db:types:check
pnpm db:advisors
pnpm db:stop
```

`pnpm db:reset` is destructive only to the local Docker database. It resets without seed, validates/applies TypeORM migrations, loads `supabase/seed.sql`, then runs pgTAP. Runtime connections use pooled `DATABASE_URL`; migration commands use `MIGRATION_DATABASE_URL` (the production workflow builds it from the existing database-password secret and Supabase session-pooler endpoint, with the pinned Supabase CA bundle and `verify-full`); `synchronize` is always disabled.

Legacy compatibility modules still import Supabase through `@iride/database/server` or `@iride/database/admin` while they are migrated. The Nest profiles module is the first actor-aware TypeORM slice and runs owner writes with transaction-local JWT claims. Admin clients are restricted to trusted API and worker runtimes. Browser and authenticated roles have no direct queue privileges; trusted services use the service-role-only queue RPC functions.

### Google authentication

Step 03 uses Google OAuth only. Add the Google Web Client ID and secret to `.env.local` using the server-only `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` variables, then restart the local Supabase stack. The local callback route is `http://localhost:3000/auth/callback`.

The web app stores the PKCE session in HttpOnly, SameSite=Lax cookies. Protected pages verify claims server-side and forward the verified access token to `GET /api/v1/auth/me`; browser code never receives the token. Email/password signup, verification, and password reset remain deferred until production SMTP is available.

Production uses `https://iride-ecru.vercel.app` and the exact callback URL `https://iride-ecru.vercel.app/auth/callback`. Do not run `supabase config push` from the local configuration because local `site_url`, API schemas, and unrelated Auth settings differ from hosted production. Apply production Auth configuration as a reviewed, field-scoped change.

### Profiles

Authenticated users complete onboarding at `/onboarding`, manage their profile at `/profile/edit`, and view public identities at `/users/<username>`. Usernames are lowercase, unique, and limited to letters, numbers, and underscores; after the initial choice they can be changed every 30 days.

The API exposes `GET/PATCH /api/v1/profile/me` and `GET /api/v1/users/<username>`. Owner endpoints require a verified Supabase Bearer token. Public DTOs omit coordinates and all Auth metadata. The `followers` visibility currently behaves like `public`; Step 09 will attach it to the follow graph and Step 10 will consume follows in the feed.

There is currently no staging Supabase project. Production project `bgflnssilreepfzxoqpc` is protected by the manual `Supabase Production` GitHub workflow and its `production` environment approval. Its one-time `bootstrap-reset` operation requires typing the project ref, uploads a backup artifact before mutation, and is intentionally separate from the normal forward-only `deploy` operation. Never run a linked reset from a developer shell.

## Jobs and Supabase Cron

The API exposes `POST /api/internal/jobs/drain` for trusted scheduling only. It requires `Authorization: Bearer $WORKER_CRON_SECRET`, accepts no application payload, starts at most two jobs per queue, and stops starting work before 45 seconds. Configure these Supabase Vault secrets before applying the cron migration:

```sql
select vault.create_secret('https://<api-host>/api/internal/jobs/drain', 'iride_job_drain_url');
select vault.create_secret('<same value as WORKER_CRON_SECRET>', 'iride_worker_cron_secret');
```

For non-serverless environments, `pnpm --filter @iride/api start:worker` runs the same services continuously with a two-second poll interval and graceful shutdown.

## Deployment targets

The deployment targets are Vercel for `web` and the Nest API, Supabase for PostgreSQL/Auth/Realtime/pgmq/Cron, and private Cloudflare R2 buckets for media. Production application deployment and database migration execution remain separately approved release actions.
