# ADR 0001: Application and package boundaries

- Status: Accepted
- Date: 2026-08-27

## Decision

Use a pnpm/Turborepo monorepo with a Next.js UI (`apps/web`), a Next.js API-only service (`apps/api`), and a long-running Node service (`apps/worker`). Shared code is exposed only through the eight `@iride/*` package exports. Browser code may not import worker infrastructure or server/worker configuration.

The API owns `/api/v1` business endpoints. The web app owns presentation and browser-safe orchestration. The worker owns retryable asynchronous work. Step 01 health endpoints remain outside the versioned business API.

## Consequences

Package exports and ESLint restrictions enforce the boundary. Cross-service contracts live in shared types/validation packages instead of importing application internals.
