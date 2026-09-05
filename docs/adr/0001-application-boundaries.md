# ADR 0001: Application and package boundaries

- Status: Accepted
- Date: 2026-08-27

## Decision

Use a pnpm/Turborepo monorepo with a Next.js App Router UI (`apps/web`) and a NestJS modular monolith (`apps/api`). The API package exposes an HTTP bootstrap, a Vercel adapter, and an optional continuous worker bootstrap. Shared code is exposed through `@iride/*` package exports. Browser code may not import worker infrastructure or server configuration.

The API owns `/api/v1` business endpoints, `/api/internal` scheduler endpoints, database transactions, and retryable jobs. The web app owns presentation, React Server Component reads, and browser-safe orchestration through same-origin BFF routes. Health endpoints remain outside the versioned business API.

## Consequences

Package exports and ESLint restrictions enforce the boundary. Cross-service contracts live in shared types/validation packages instead of importing application internals.
