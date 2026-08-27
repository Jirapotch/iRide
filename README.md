# iRide

iRide is a mobile-first, bilingual community for people who love cars and the stories behind every drive. This repository currently contains the platform foundation only; business features begin in Step 02 of the implementation plans.

## Repository layout

- `apps/web` — Next.js 16 App Router UI on port 3000
- `apps/api` — Next.js 16 API-only service on port 3001
- `apps/worker` — long-running Node.js worker and health server on port 3002
- `packages/*` — shared auth, config, database, domain, storage, types, UI, and validation boundaries
- `.plans` — version-controlled implementation roadmap
- `docs/adr` — accepted architecture decisions

## Prerequisites

- Node.js 22 (the repository includes `.nvmrc` and `.node-version`)
- Corepack with pnpm 11.19.0
- Docker-compatible runtime with at least 7 GB available for the local Supabase stack
- Docker for the optional local worker container smoke test

The current development machine may use another Node version, but CI and production images use Node 22. Use Node 22 before treating a local verification as release-equivalent.

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

Open `http://localhost:3000/th` or `http://localhost:3000/en`. Health probes are available at:

- `http://localhost:3000/api/health` — web
- `http://localhost:3001/api/health` — API
- `http://localhost:3002/health` — worker

The worker validates all server credentials at startup. For local health testing, placeholder values from `.env.example` are sufficient; they do not grant access to external services.

## Quality commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm check
```

`pnpm check` runs lint, typecheck, unit tests, and production builds. Playwright is separate because it starts local web/API servers and requires a browser installed with `pnpm exec playwright install chromium`. CI runs both suites.

## Supabase development

SQL migrations under `supabase/migrations` are the database source of truth. The local stack uses PostgreSQL 17 with Auth, Realtime, PostGIS, pgmq queues, and deny-by-default database privileges. Start and verify it with:

```bash
pnpm db:start
pnpm db:reset
pnpm db:test
pnpm db:types
pnpm db:types:check
pnpm db:advisors
pnpm db:stop
```

`pnpm db:reset` is destructive only to the local Docker database. It replays every migration and the deterministic `supabase/seed.sql`. The two foundation identities have fixed UUIDs and no password or provider identity, so they cannot sign in.

Applications import Supabase through `@iride/database/browser`, `@iride/database/server`, or `@iride/database/admin`. Admin clients are restricted to trusted API and worker runtimes. Browser and authenticated roles have no direct queue privileges; trusted services use the service-role-only queue RPC functions.

### Google authentication

Step 03 uses Google OAuth only. Add the Google Web Client ID and secret to `.env.local` using the server-only `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` variables, then restart the local Supabase stack. Local callback routes are `http://localhost:3000/th/auth/callback` and `http://localhost:3000/en/auth/callback`.

The web app stores the PKCE session in HttpOnly, SameSite=Lax cookies. Protected pages verify claims server-side and forward the verified access token to `GET /api/v1/auth/me`; browser code never receives the token. Email/password signup, verification, and password reset remain deferred until production SMTP is available.

Production uses `https://iride-ecru.vercel.app` and exact Thai/English callback URLs. Do not run `supabase config push` from the local configuration because local `site_url`, API schemas, and unrelated Auth settings differ from hosted production. Apply production Auth configuration as a reviewed, field-scoped change.

There is currently no staging Supabase project. Production project `bgflnssilreepfzxoqpc` is protected by the manual `Supabase Production` GitHub workflow and its `production` environment approval. Its one-time `bootstrap-reset` operation requires typing the project ref, uploads a backup artifact before mutation, and is intentionally separate from the normal forward-only `deploy` operation. Never run a linked reset from a developer shell.

## Worker container

Build from the repository root:

```bash
docker build -f apps/worker/Dockerfile -t iride-worker .
```

Run it with the server-only variables listed in `.env.example`. The image uses Node 22, runs as the unprivileged `node` user, and exposes port 3002. Docker is not installed on every development machine, so the authoritative container smoke test runs in GitHub Actions.

## Deployment targets

The deployment targets are Vercel for `web` and `api`, Railway for the worker container, Supabase for PostgreSQL/Auth/Realtime/Queues, and private Cloudflare R2 buckets for media.
