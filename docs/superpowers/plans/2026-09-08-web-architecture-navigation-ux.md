# Web Architecture and Navigation UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make iRide navigation respond immediately, stream meaningful destination UI, preserve accessible focus, and establish maintainable web feature boundaries without changing product behavior.

**Architecture:** Keep route composition in `src/app`, move reusable navigation and feature behavior into focused `src/features` modules, and use Next.js 16 Link/loading/Suspense primitives. Preserve server authorization and the existing Redux/Saga preference boundary.

**Tech Stack:** Next.js 16.3, React 19, TypeScript 5.9, Ant Design 6, Redux Toolkit/Saga, Vitest 4, Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-09-08-web-architecture-navigation-ux-design.md`

## Global Constraints

- Preserve routes, business rules, permissions, validation, DTOs, and external API contracts.
- Keep Games visually standalone.
- Use framework navigation and streaming primitives before custom state.
- Do not remove keyboard focus indicators or use programmatic blur as a focus fix.
- Do not move unrelated code or styles.

---

### Task 1: Restore a trustworthy UX test baseline

**Files:**

- Create: `tests/e2e/navigation-ux.spec.ts`
- Modify: `playwright.config.ts`
- Test: `tests/e2e/navigation-ux.spec.ts`

**Interfaces:**

- Consumes: public routes and accessible names already exposed by the application.
- Produces: deterministic contracts for immediate pending feedback, route focus, pointer focus, persistent shell, and Games navigation.

- [ ] Write a failing Playwright test that holds an RSC destination request and asserts the clicked link becomes busy while another destination remains operable.
- [ ] Run `pnpm test:e2e -- --project=mobile-chrome tests/e2e/navigation-ux.spec.ts` and confirm the new unmet expectation fails for the intended reason.
- [ ] Add desktop Chromium and mobile WebKit projects to `playwright.config.ts`, keeping the existing Pixel 7 project.
- [ ] Add tests for keyboard-visible focus, pointer click without selected-looking focus, reduced motion, direct deep links, and destination shell persistence.
- [ ] Re-run the focused E2E file and record any environment blockers separately from product failures.

### Task 2: Establish navigation feature boundaries

**Files:**

- Create: `apps/web/src/features/navigation/components/pending-link.tsx`
- Create: `apps/web/src/features/navigation/components/route-focus-manager.tsx`
- Create: `apps/web/src/features/navigation/components/route-transition.tsx`
- Create: `apps/web/src/features/navigation/components/breadcrumbs.tsx`
- Create: `apps/web/src/features/navigation/components/history-back-button.tsx`
- Create: `apps/web/src/features/navigation/navigation-domain.ts`
- Modify: route and component imports under `apps/web/src/app/(main)` and `apps/web/src/features/admin`

**Interfaces:**

- Consumes: Next.js `Link`, `useLinkStatus`, pathname/search parameters, and localized breadcrumb inputs.
- Produces: `PendingLink`, `RouteFocusManager`, `RouteTransition`, `Breadcrumbs`, `HistoryBackButton`, and pure route-domain helpers.

- [ ] Write failing focused tests for route-location classification and focus destination policy.
- [ ] Run the focused Vitest tests and verify they fail because the feature-owned interfaces do not exist.
- [ ] Move the existing behavior behind feature-owned exports without changing rendered output.
- [ ] Update consumers and run the focused tests until green.
- [ ] Remove obsolete route-private implementations only after `rg` confirms no remaining imports.

### Task 3: Correct pointer, keyboard, and pending interaction states

**Files:**

- Modify: `apps/web/src/app/(main)/_components/home/feature-selection.tsx`
- Modify: `apps/web/src/app/(main)/_components/home/home.module.css`
- Modify: `apps/web/src/features/navigation/components/pending-link.tsx`
- Test: focused navigation policy tests and `tests/e2e/navigation-ux.spec.ts`

**Interfaces:**

- Consumes: pointer type, `:focus-visible`, current location, and Next.js link pending state.
- Produces: distinct hover, pressed, keyboard-focus, and pending visuals.

- [ ] Add a failing test demonstrating that pointer focus does not activate the expanded-card state while keyboard focus does.
- [ ] Verify the test fails against the current unconditional `onFocus` behavior.
- [ ] Implement modality-aware card activation without calling `blur()` or hiding `:focus-visible`.
- [ ] Add a failing recovery test for a navigation that never enters Next.js pending state.
- [ ] Keep same-destination duplicate suppression scoped and recoverable, then make both tests green.

### Task 4: Stream destination-shaped loading UI

**Files:**

- Modify: `apps/web/src/app/(main)/layout.tsx`
- Create: `apps/web/src/app/(main)/_components/app-shell-skeleton.tsx`
- Create: `apps/web/src/app/(main)/maps/loading.tsx`
- Create: `apps/web/src/app/(games)/games/loading.tsx`
- Create: `apps/web/src/app/(games)/games/traffic-endless-ride/loading.tsx`
- Modify: `apps/web/src/app/(main)/community/loading.tsx`
- Modify: `apps/web/src/app/(main)/_components/page-skeletons.tsx`

**Interfaces:**

- Consumes: locale-aware labels and existing page layout classes.
- Produces: persistent neutral shell fallback and content-shaped localized skeletons.

- [ ] Write failing render/policy tests for Thai and English loading labels and route-specific skeleton identity.
- [ ] Verify failure before adding localized skeleton props.
- [ ] Add localized map, community, Games, and shell skeletons with `aria-busy` and stable layout dimensions.
- [ ] Isolate auth-dependent shell data behind a Suspense boundary or equivalent server composition so runtime reads do not block neutral shell feedback.
- [ ] Run focused tests and E2E slow-navigation coverage until green.

### Task 5: Split oversized navigation and touched feature components

**Files:**

- Split: `apps/web/src/app/(main)/_components/app-navigation.tsx`
- Split touched responsibilities from: `activity-hub.tsx`, `community-screen.tsx`, `create-content-screen.tsx`, and `users/[username]/user-profile-screen.tsx`
- Create feature-owned components under `apps/web/src/features/navigation`, `features/activities`, `features/community`, `features/content`, and `features/profile`

**Interfaces:**

- Consumes: serializable server DTOs, locale, auth capability flags, and existing server actions.
- Produces: narrow components for header actions, settings, notifications, bottom navigation, map controls/details, community posts/comments, create forms, and profile tabs/garage.

- [ ] Characterize each touched public component before moving logic.
- [ ] Extract one named responsibility at a time and update imports.
- [ ] Run its focused tests after every extraction.
- [ ] Keep route files server-first and keep client directives at the smallest interactive boundary.
- [ ] Stop splitting when each remaining file has one coherent reason to change.

### Task 6: Introduce safe typed data failures and complete state coverage

**Files:**

- Modify: `apps/web/src/lib/data-result.ts`
- Modify only consumers that currently call `captureData`
- Create or modify feature-local empty/error components as required
- Test: `apps/web/src/lib/data-result.test.ts` and affected feature tests

**Interfaces:**

- Consumes: unknown exceptions and known browser/API error shapes.
- Produces: `DataResult<T>` with safe categories `unavailable`, `unauthorized`, `forbidden`, `not-found`, `validation`, and `unknown`.

- [ ] Write failing tests for classification without leaking raw backend messages.
- [ ] Implement the minimal classifier and preserve the successful result shape.
- [ ] Update each consumer to render distinct empty and error states with retry only where meaningful.
- [ ] Confirm auth failures never degrade into misleading anonymous/admin state.
- [ ] Run all affected unit and E2E tests.

### Task 7: Localize and colocate touched styles

**Files:**

- Modify: `apps/web/src/app/globals.css`
- Modify or create colocated CSS modules only for features changed by Tasks 2-6

**Interfaces:**

- Consumes: existing design tokens and DOM class contracts.
- Produces: feature-scoped interaction/loading styles while retaining global reset, tokens, and shell primitives.

- [ ] Move one feature's selectors at a time and verify computed styles before deleting global selectors.
- [ ] Preserve `:focus-visible`, custom tap feedback, reduced-motion rules, and minimum target sizes.
- [ ] Run visual E2E assertions after each stylesheet move.
- [ ] Use `rg` to prove deleted global selectors have no consumers.

### Task 8: Full verification and report

**Files:**

- Modify: `docs/ui-migration-notes.md`
- Create: final architecture tree and remaining-debt section in the migration notes.

**Interfaces:**

- Consumes: all preceding deliverables.
- Produces: verified implementation evidence and the report requested by the source brief.

- [ ] Run `pnpm lint` and require exit code 0 with no new warnings.
- [ ] Regenerate Next route types, run `pnpm typecheck`, and distinguish stale generated artifacts from source errors.
- [ ] Run `pnpm test` and `pnpm build`.
- [ ] Run the navigation UX E2E matrix.
- [ ] Review the diff for route, auth, permission, validation, and API-contract changes.
- [ ] Document the old problems, new structure, moved files, separated logic, loading/focus fixes, performance impact, breaking-change status, and remaining debt.
