# Navigation UX Polish and Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete mutation repeat-submit protection, subtle route transitions, remaining route integration, and production-grade verification of the navigation experience.

**Architecture:** Reuse the foundation primitives instead of adding parallel state systems. A pathname-keyed Client Component applies entrance-only motion, scoped form-status buttons protect mutations, and a final route inventory closes coverage gaps before full production and browser verification.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript 5.9, Vitest 4, Playwright 1.62, CSS.

**Spec:** `docs/superpowers/specs/2026-09-06-navigation-ux-loading-breadcrumb-design.md`

**Depends on:** Plans 01–03 in this series.

## Global Constraints

- Execute plans 01–03 first.
- No exit animation may delay route execution.
- Page entrance uses opacity plus at most 8 px translation over 180–220 ms.
- The existing reduced-motion override makes route movement effectively imperceptible and the transition instant.
- Pending state remains scoped to the action that initiated it.
- Required auth, authorization, validation, and confirmation behavior remains unchanged.
- Final claims require fresh lint, typecheck, unit-test, build, and Playwright evidence.

---

### Task 1: Shared mutation submit feedback

**Files:**

- Modify: `apps/web/src/app/(main)/_components/action-submit-button.tsx:1`
- Modify: `apps/web/src/app/(main)/settings/users/[id]/page.tsx:1`
- Modify: `apps/web/src/app/(main)/_components/community-screen.tsx:205`
- Modify: `apps/web/src/app/(main)/_components/activity-hub.tsx:630`
- Modify: `tests/e2e/navigation.spec.ts:1`

**Interfaces:**

- Extends `ActionSubmitButton` with optional `className` and `ariaLabel` while retaining existing callers.
- Every admin/content mutation uses one pending control with `aria-busy`, disabled state, spinner, and localized pending label.

- [ ] **Step 1: Write the failing repeat-submit test**

```ts
test("admin mutation acknowledges one submit while pending", async ({
  page,
}) => {
  await page.goto("/login?next=%2Fsettings%2Fusers");
  await page.getByRole("button", { name: /Google/ }).click();
  await page.getByRole("link", { name: /Locked Rider/ }).click();
  const unlock = page.getByRole("button", { name: "Unlock", exact: true });
  await unlock.dblclick({ noWaitAfter: true });
  await expect(unlock).toBeDisabled();
  await expect(unlock).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Unlocking…")).toBeVisible();
  await expect(page.getByText("user · active", { exact: true })).toBeVisible();
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm test:e2e
```

Expected: FAIL because Admin uses a plain submit button.

- [ ] **Step 3: Extend and apply the shared button**

```tsx
export function ActionSubmitButton({
  ariaLabel,
  children,
  className = "primary-action",
  pendingLabel,
}: {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending}
      aria-label={ariaLabel}
      className={className}
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <>
          <CircleNotch aria-hidden className="button-spinner" size={17} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
```

Replace Admin access/delete, Community owner delete, and Map owner delete submit buttons. Keep each existing confirmation in the form's `onSubmit`; cancellation must prevent the action before pending begins.

- [ ] **Step 4: Verify and commit**

```powershell
pnpm --filter @iride/web typecheck
pnpm test:e2e
git add 'apps/web/src/app/(main)/_components/action-submit-button.tsx' 'apps/web/src/app/(main)/settings/users/[id]/page.tsx' 'apps/web/src/app/(main)/_components/community-screen.tsx' 'apps/web/src/app/(main)/_components/activity-hub.tsx' tests/e2e/navigation.spec.ts
git commit -m "feat(web): prevent repeated mutations"
```

Expected: commands exit 0 before commit.

### Task 2: Entrance-only route transition

**Files:**

- Create: `apps/web/src/app/(main)/_components/route-transition.tsx`
- Modify: `apps/web/src/app/(main)/_components/app-shell.tsx:1`
- Modify: `apps/web/src/app/globals.css:2626`
- Modify: `tests/e2e/premium-ui.spec.ts:1`

**Interfaces:**

- Produces: `<RouteTransition>{children}</RouteTransition>` keyed only by pathname.
- Query updates do not replay page entrance motion.

- [ ] **Step 1: Write failing normal/reduced-motion tests**

```ts
test("route content uses a short entrance without delaying navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Search" }).click();
  const content = page.locator('[data-ui="route-content"]');
  await expect(page).toHaveURL(/\/search$/);
  await expect(content).toHaveCSS("animation-name", "route-content-enter");
  await expect(content).toHaveCSS("animation-duration", "0.2s");
});

test("reduced motion collapses the route animation duration", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/search");
  const content = page.locator('[data-ui="route-content"]');
  const durationSeconds = await content.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).animationDuration),
  );
  expect(durationSeconds).toBeLessThanOrEqual(0.00001);
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm test:e2e
```

Expected: FAIL because no route transition wrapper exists.

- [ ] **Step 3: Implement the pathname-keyed wrapper**

```tsx
"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function RouteTransition({
  children,
}: {
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="route-content" data-ui="route-content" key={pathname}>
      {children}
    </div>
  );
}
```

Wrap only `AppShell` page children; keep the header and mobile navigation outside.

- [ ] **Step 4: Add non-blocking CSS**

```css
.route-content {
  animation: route-content-enter 0.2s ease-out both;
}
@keyframes route-content-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
```

Do not add a second reduced-motion rule. The existing global `prefers-reduced-motion` override already reduces all animation durations to `0.01ms` (`0.00001s`).

- [ ] **Step 5: Verify and commit**

```powershell
pnpm test:e2e
pnpm --filter @iride/web lint
git add 'apps/web/src/app/(main)/_components/route-transition.tsx' 'apps/web/src/app/(main)/_components/app-shell.tsx' apps/web/src/app/globals.css tests/e2e/premium-ui.spec.ts
git commit -m "feat(web): add subtle route entrance"
```

Expected: commands exit 0 before commit.

### Task 3: Complete route and interaction inventory

**Files:**

- Modify: `apps/web/src/app/(main)/notifications/page.tsx:1`
- Modify: `apps/web/src/app/(main)/search/page.tsx:1`
- Modify: `apps/web/src/app/(main)/maps/page.tsx:1`
- Modify: `apps/web/src/app/(main)/create/page.tsx:1`
- Modify: `apps/web/src/app/(main)/settings/users/page.tsx:1`
- Modify: `apps/web/src/app/(main)/settings/users/[id]/page.tsx:1`
- Modify: `apps/web/src/app/(main)/_components/app-navigation.tsx:1`
- Modify: `apps/web/src/features/admin/admin-user-directory.tsx:1`
- Modify: `apps/web/src/app/globals.css:1`
- Modify: `tests/e2e/navigation.spec.ts:1`

**Interfaces:**

- Every depth-two route consumes `resolveBreadcrumbs` and `<Breadcrumbs>`.
- Every internal navigation surface uses `PendingLink` unless it is a history Back button or mutation submit.
- Every page heading supports route focus.

- [ ] **Step 1: Add the failing inventory test**

```ts
test("current main routes expose navigation UX contracts", async ({ page }) => {
  for (const route of [
    "/search",
    "/maps",
    "/notifications",
    "/community/groups",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1[data-route-heading]")).toHaveCount(1);
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeVisible();
  }
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm test:e2e
```

Expected: FAIL on any route not yet integrated.

- [ ] **Step 3: Finish route integrations**

For each listed page, render resolved breadcrumbs before the heading and set exactly one `h1[data-route-heading][tabindex="-1"]`. Convert navigation links in drawer rows, notification popover, search results, profile tabs/cards, and Admin rows to `PendingLink`. Do not convert external Google Maps links, skip links, or links that intentionally perform a document navigation.

- [ ] **Step 4: Verify keyboard and semantics**

Extend the inventory test to Tab through a breadcrumb ancestor and confirm visible focus. Assert the current crumb is a non-link element with `aria-current="page"`. At 390 px assert only the compact crumb is visually displayed; at 1280 px assert the full list is displayed.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --filter @iride/web lint
pnpm --filter @iride/web typecheck
pnpm test:e2e
git add 'apps/web/src/app/(main)' apps/web/src/features/admin/admin-user-directory.tsx apps/web/src/app/globals.css tests/e2e/navigation.spec.ts
git commit -m "feat(web): complete navigation UX coverage"
```

Expected: commands exit 0 before commit.

### Task 4: Production perceived-performance verification

**Files:**

- Modify: `tests/e2e/navigation.spec.ts:1`
- Create: `.artifacts/navigation-ux/.gitkeep`
- Modify: `.gitignore:1`

**Interfaces:**

- Adds production-only acceptance coverage for prefetch/loading behavior.
- Stores screenshots under `.artifacts/navigation-ux/`; `.gitignore` excludes generated PNGs while retaining `.gitkeep`.

- [ ] **Step 1: Add delayed-route acceptance coverage**

```ts
test("a delayed route keeps the old shell interactive and shows destination loading", async ({
  page,
}) => {
  await page.goto("/");
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/community/groups*", async (route) => {
    if (route.request().headers().rsc === "1") await held;
    await route.continue();
  });
  try {
    await page
      .getByRole("link", { name: "Groups", exact: true })
      .click({ noWaitAfter: true });
    await expect(
      page.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeVisible();
    await expect(
      page.locator('[data-ui="community-feed-skeleton"]'),
    ).toBeVisible();
    await page.getByRole("link", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/\/search$/);
  } finally {
    release?.();
  }
});
```

- [ ] **Step 2: Run production E2E**

```powershell
pnpm test:e2e
```

Expected: all Playwright tests pass using `next start`; no route request remains blocked.

- [ ] **Step 3: Capture representative states**

```ts
await page.screenshot({
  path: ".artifacts/navigation-ux/mobile-community-loading.png",
  fullPage: true,
});
await page.screenshot({
  path: ".artifacts/navigation-ux/desktop-profile-progressive.png",
  fullPage: true,
});
await page.screenshot({
  path: ".artifacts/navigation-ux/mobile-search-error.png",
  fullPage: true,
});
await page.screenshot({
  path: ".artifacts/navigation-ux/desktop-admin-breadcrumb.png",
  fullPage: true,
});
```

Inspect each image for wrong state, clipping, blank content, layout shift, and visible focus. Recapture rejected images after fixing the underlying defect.

Add `/.artifacts/navigation-ux/*.png` to `.gitignore` before capturing so verification artifacts cannot dirty the branch.

- [ ] **Step 4: Commit the acceptance test**

```powershell
git add tests/e2e/navigation.spec.ts .artifacts/navigation-ux/.gitkeep .gitignore
git commit -m "test(web): verify perceived navigation performance"
```

### Task 5: Full verification and requirement audit

**Files:**

- Modify only the file responsible for a failing check.

**Interfaces:**

- Verifies every acceptance criterion in the approved spec before completion is claimed.

- [ ] **Step 1: Run formatting and static checks**

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
```

Expected: all commands exit 0 with no new warnings.

- [ ] **Step 2: Run unit and production build checks**

```powershell
pnpm test
pnpm build
```

Expected: all tests pass and every package build exits 0.

- [ ] **Step 3: Run the complete browser suite**

```powershell
pnpm test:e2e
```

Expected: zero Playwright failures.

- [ ] **Step 4: Audit the implementation against the spec**

Confirm each item with code or test evidence: immediate acknowledgement, destination skeleton, independent section reveal, error-versus-empty semantics, Breadcrumb hierarchy, real Back behavior, URL state preservation, scroll restoration, prefetch use, repeat-submit prevention, scoped errors with Retry, focus management, reduced motion, and preserved auth/business behavior.

- [ ] **Step 5: Inspect repository state and commit verification fixes**

```powershell
git diff --check
git status --short
git log --oneline --decorate -15
```

Expected: no whitespace errors or unintended files. If verification required a fix, commit only its focused files with `fix(web): correct navigation UX regression`; otherwise do not create an empty commit.

- [ ] **Step 6: Request final code review**

Invoke `superpowers:requesting-code-review`, address findings with the appropriate review workflow, rerun the complete verification commands, and only then use `superpowers:finishing-a-development-branch` to choose merge/PR handling.
