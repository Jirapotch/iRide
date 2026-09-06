# Navigation UX Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared breadcrumb, pending-link, focus-management, and skeleton primitives, then apply them to the public Community entry flow.

**Architecture:** Pure route-domain functions produce localized breadcrumbs. Small Client Components own click acknowledgement and route focus while Server Components keep destination structure renderable. Shared skeletons establish the loading contract used by later plans.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript 5.9, Vitest 4, Playwright 1.62, CSS.

**Spec:** `docs/superpowers/specs/2026-09-06-navigation-ux-loading-breadcrumb-design.md`

**Depends on:** None.

## Global Constraints

- Preserve business behavior, routes, API contracts, permissions, and Matcha styling.
- Do not add a global loading overlay or a data-fetching library.
- Pressed feedback begins in the click frame and lasts no longer than 180 ms.
- Pending feedback may appear after 100 ms and must not shift layout.
- Motion never delays navigation and honors `prefers-reduced-motion`.
- Use `next/link` for internal destinations and retain framework prefetching.
- Follow `apps/web/AGENTS.md` and the installed Next.js 16.3.1 documentation.

---

### Task 1: Central breadcrumb route model

**Files:**

- Modify: `apps/web/src/lib/app-navigation-domain.ts:1`
- Modify: `apps/web/src/lib/app-navigation-domain.test.ts:1`

**Interfaces:**

- Consumes: `Locale`, canonical pathname, optional entity label, parent href, and active tab.
- Produces: `BreadcrumbItem`, `BreadcrumbContext`, and `resolveBreadcrumbs(pathname, context)`.

- [ ] **Step 1: Write the failing tests**

```ts
it("resolves a localized nested community hierarchy", () => {
  expect(resolveBreadcrumbs("/community/car/talk", { locale: "en" })).toEqual([
    { key: "home", label: "Home", href: "/" },
    { key: "community-car", label: "Cars", href: "/community/car" },
    { key: "community-talk", label: "Talk" },
  ]);
});

it("keeps a context-preserving admin parent href", () => {
  expect(
    resolveBreadcrumbs("/settings/users/user-1", {
      locale: "th",
      entityLabel: "สมชาย",
      parentHref: "/settings/users?q=som&page=2",
    }),
  ).toEqual([
    { key: "home", label: "หน้าหลัก", href: "/" },
    {
      key: "admin-users",
      label: "จัดการผู้ใช้",
      href: "/settings/users?q=som&page=2",
    },
    { key: "admin-user", label: "สมชาย" },
  ]);
});

it("uses the active profile tab as the final item", () => {
  expect(
    resolveBreadcrumbs("/users/maya", {
      locale: "en",
      entityLabel: "Maya",
      tab: "garage",
    }),
  ).toEqual([
    { key: "home", label: "Home", href: "/" },
    { key: "profile", label: "Maya", href: "/users/maya" },
    { key: "profile-garage", label: "Garage" },
  ]);
});
```

- [ ] **Step 2: Run the test and verify RED**

```powershell
pnpm --filter @iride/web test -- src/lib/app-navigation-domain.test.ts
```

Expected: FAIL because `resolveBreadcrumbs` is not exported.

- [ ] **Step 3: Implement the route model**

Add these public types and use one internal route-pattern table for Home, Community, Maps, Search, Create, Notifications, Profile, and Admin. Pages may provide dynamic labels but may not construct breadcrumb arrays.

```ts
import type { Locale } from "./locale";

export interface BreadcrumbItem {
  readonly key: string;
  readonly label: string;
  readonly href?: string;
}

export interface BreadcrumbContext {
  readonly locale: Locale;
  readonly entityLabel?: string;
  readonly parentHref?: string;
  readonly tab?: string;
}

const breadcrumbLabels = {
  th: {
    home: "หน้าหลัก",
    talk: "พูดคุย",
    groups: "กลุ่ม",
    maps: "แผนที่",
    search: "ค้นหา",
    create: "สร้าง",
    notifications: "การแจ้งเตือน",
    manageUsers: "จัดการผู้ใช้",
    garage: "โรงรถ",
    activities: "กิจกรรม",
  },
  en: {
    home: "Home",
    talk: "Talk",
    groups: "Groups",
    maps: "Maps",
    search: "Search",
    create: "Create",
    notifications: "Notifications",
    manageUsers: "Manage users",
    garage: "Garage",
    activities: "Activities",
  },
} as const;

const vehicleBreadcrumbLabels = {
  car: { th: "รถยนต์", en: "Cars" },
  motorcycle: { th: "มอเตอร์ไซค์", en: "Motorcycles" },
  bicycle: { th: "จักรยาน", en: "Bicycles" },
} as const;
```

Implement `resolveBreadcrumbs` with anchored regexes. Encode dynamic username hrefs, use `parentHref ?? "/settings/users"` for admin detail, and return the Home-only array for unknown routes.

- [ ] **Step 4: Run the test and verify GREEN**

```powershell
pnpm --filter @iride/web test -- src/lib/app-navigation-domain.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/app-navigation-domain.ts apps/web/src/lib/app-navigation-domain.test.ts
git commit -m "feat(web): add breadcrumb route model"
```

### Task 2: Responsive breadcrumb UI

**Files:**

- Create: `apps/web/src/app/(main)/_components/breadcrumbs.tsx`
- Modify: `apps/web/src/app/globals.css:2312`
- Modify: `apps/web/src/app/(main)/community/[vehicle]/page.tsx:1`
- Modify: `apps/web/src/app/(main)/_components/community-feed-page.tsx:1`
- Modify: `tests/e2e/navigation.spec.ts:1`

**Interfaces:**

- Consumes: `readonly BreadcrumbItem[]` from Task 1.
- Produces: `<Breadcrumbs items={items} />` with desktop hierarchy and a compact mobile parent link.

- [ ] **Step 1: Write the failing E2E test**

```ts
test("nested community routes expose responsive breadcrumbs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/community/car/talk");
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(breadcrumb.getByRole("link", { name: "Cars" })).toBeVisible();
  await expect(breadcrumb.getByText("Talk", { exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(breadcrumb.locator(".breadcrumb-full")).toHaveCSS(
    "position",
    "absolute",
  );
  await expect(
    breadcrumb.getByRole("link", { name: "Back to Cars" }),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run the test and verify RED**

```powershell
pnpm test:e2e
```

Expected: FAIL because Breadcrumb navigation does not exist.

- [ ] **Step 3: Create the component**

```tsx
import Link from "next/link";

import type { BreadcrumbItem } from "@/lib/app-navigation-domain";

export function Breadcrumbs({
  items,
}: {
  readonly items: readonly BreadcrumbItem[];
}) {
  if (items.length < 2) return null;
  const parent = items.at(-2);
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumb-full">
        {items.map((item) => (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
      {parent?.href ? (
        <Link
          aria-label={`Back to ${parent.label}`}
          className="breadcrumb-compact"
          href={parent.href}
        >
          ← {parent.label}
        </Link>
      ) : null}
    </nav>
  );
}
```

- [ ] **Step 4: Style and integrate**

```css
.breadcrumbs {
  width: min(100%, 1060px);
  margin: 0 auto 1rem;
  color: var(--muted-foreground);
  font-size: 0.78rem;
  font-weight: 750;
}
.breadcrumb-full {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  list-style: none;
}
.breadcrumb-full li + li::before {
  margin-right: 0.5rem;
  content: "/";
  color: var(--border);
}
.breadcrumb-compact {
  display: none;
  min-height: 44px;
  align-items: center;
}
@media (max-width: 640px) {
  .breadcrumb-full {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .breadcrumb-compact {
    display: inline-flex;
  }
}
```

Use the visually-hidden treatment instead of `display: none` so assistive technology retains the complete hierarchy on mobile while sighted users get the compact parent control.

In Community pages, call `resolveBreadcrumbs` with their canonical path and locale, render `<Breadcrumbs>` before the heading, and add `data-route-heading tabIndex={-1}` to each `<h1>`.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm test:e2e
pnpm --filter @iride/web lint
git add 'apps/web/src/app/(main)/_components/breadcrumbs.tsx' 'apps/web/src/app/(main)/community' 'apps/web/src/app/(main)/_components/community-feed-page.tsx' apps/web/src/app/globals.css tests/e2e/navigation.spec.ts
git commit -m "feat(web): add responsive community breadcrumbs"
```

Expected: tests and lint exit 0 before commit.

### Task 3: Pending link and duplicate-click lock

**Files:**

- Create: `apps/web/src/app/(main)/_components/pending-link.tsx`
- Modify: `apps/web/src/app/(main)/_components/app-navigation.tsx:350`
- Modify: `apps/web/src/app/(main)/page.tsx:22`
- Modify: `apps/web/src/app/(main)/community/[vehicle]/page.tsx:13`
- Modify: `apps/web/src/app/globals.css:284`
- Modify: `tests/e2e/navigation.spec.ts:1`

**Interfaces:**

- Produces: `<PendingLink>` accepting normal `LinkProps` and anchor attributes.
- Uses: `useLinkStatus` for framework pending state and a pathname reset for duplicate plain-click suppression.

- [ ] **Step 1: Write a failing delayed-navigation test**

```ts
test("a slow destination acknowledges one navigation", async ({ page }) => {
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/community/car", async (route) => {
    if (route.request().headers().rsc === "1") await held;
    await route.continue();
  });
  await page.goto("/");
  const cars = page.getByRole("link", { name: "Cars", exact: true });
  await cars.click({ noWaitAfter: true });
  await expect(cars).toHaveAttribute("aria-busy", "true");
  await expect(cars.locator(".link-pending-indicator")).toHaveAttribute(
    "data-pending",
    "true",
  );
  await cars.click({ noWaitAfter: true });
  release?.();
  await expect(page).toHaveURL(/\/community\/car$/);
});
```

- [ ] **Step 2: Run it and verify RED**

```powershell
pnpm test:e2e
```

Expected: FAIL because links expose no pending state.

- [ ] **Step 3: Implement the primitive**

Create a Client Component. Render a descendant that calls `useLinkStatus()` and always reserves a two-pixel indicator slot. Track `acknowledged` after an unmodified primary click; call the supplied `onClick` first, ignore prevented/new-tab/modifier clicks, prevent further plain activations while acknowledged, and reset on pathname/search-parameter change. Set `aria-busy` while acknowledged.

```tsx
function PendingIndicator() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className="link-pending-indicator"
      data-pending={pending ? "true" : "false"}
    />
  );
}
```

- [ ] **Step 4: Apply it and add tactile CSS**

Replace primary navigation links, Home category cards, and vehicle room cards with `PendingLink`.

```css
:where(
  .nav-item,
  .create-nav,
  .community-category-card,
  .community-room-grid a,
  .search-result-row,
  .admin-user-list > a,
  .admin-user-table a,
  .drawer-row,
  .profile-tabs a
) {
  position: relative;
  transition:
    transform 0.14s ease,
    opacity 0.14s ease,
    background-color 0.14s ease,
    box-shadow 0.14s ease;
}
:where(
  .nav-item,
  .create-nav,
  .community-category-card,
  .community-room-grid a,
  .search-result-row,
  .admin-user-list > a,
  .admin-user-table a,
  .drawer-row,
  .profile-tabs a
):active {
  transform: translateY(1px) scale(0.985);
  opacity: 0.82;
}
.link-pending-indicator {
  position: absolute;
  inset: auto 0 0;
  height: 2px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0.25);
  transform-origin: left;
}
.link-pending-indicator[data-pending="true"] {
  animation: pending-link-reveal 0.2s ease 0.1s forwards;
}
a[aria-busy="true"] {
  pointer-events: none;
}
@keyframes pending-link-reveal {
  to {
    opacity: 0.45;
    transform: scaleX(0.72);
  }
}
```

- [ ] **Step 5: Verify and commit**

```powershell
pnpm test:e2e
pnpm --filter @iride/web typecheck
git add 'apps/web/src/app/(main)/_components/pending-link.tsx' 'apps/web/src/app/(main)/_components/app-navigation.tsx' 'apps/web/src/app/(main)/page.tsx' 'apps/web/src/app/(main)/community/[vehicle]/page.tsx' apps/web/src/app/globals.css tests/e2e/navigation.spec.ts
git commit -m "feat(web): acknowledge pending navigation"
```

Expected: tests and typecheck exit 0 before commit.

### Task 4: Route focus and shared skeletons

**Files:**

- Create: `apps/web/src/app/(main)/_components/route-focus-manager.tsx`
- Create: `apps/web/src/app/(main)/_components/page-skeletons.tsx`
- Modify: `apps/web/src/app/(main)/_components/app-shell.tsx:1`
- Modify: `apps/web/src/app/(main)/community/loading.tsx:1`
- Modify: `apps/web/src/app/globals.css:2626`
- Modify: `tests/e2e/navigation.spec.ts:1`

**Interfaces:**

- Produces: `<RouteFocusManager />`, `<CommunityFeedSkeleton />`, `<ProfileSkeleton />`, `<AdminListSkeleton />`, and `<AdminDetailSkeleton />`.

- [ ] **Step 1: Write failing focus and skeleton tests**

```ts
test("pathname navigation focuses the destination heading", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Cars", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cars" })).toBeFocused();
});

test("community loading matches the feed layout", async ({ page }) => {
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
    const skeleton = page.locator('[data-ui="community-feed-skeleton"]');
    await expect(skeleton).toHaveAttribute("aria-busy", "true");
    await expect(skeleton.locator(".skeleton-card")).toHaveCount(3);
  } finally {
    release?.();
  }
  await expect(page).toHaveURL(/\/community\/groups$/);
});
```

- [ ] **Step 2: Run them and verify RED**

```powershell
pnpm test:e2e
```

Expected: FAIL because focus remains on the document and the old fallback has no card skeletons.

- [ ] **Step 3: Implement pathname-only focus**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function RouteFocusManager() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const frame = requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>("[data-route-heading]")
        ?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return null;
}
```

Render it once in `AppShell`. Query-only changes must not trigger focus movement.

- [ ] **Step 4: Create deterministic skeletons**

```tsx
export function CommunityFeedSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading community feed"
      data-ui="community-feed-skeleton"
    >
      {["first", "second", "third"].map((key) => (
        <article aria-hidden="true" className="skeleton-card" key={key}>
          <span className="skeleton-line is-short" />
          <span className="skeleton-line" />
          <span className="skeleton-line is-medium" />
        </article>
      ))}
    </section>
  );
}
```

Export profile/admin skeletons with stable `data-ui` names. Replace `community/loading.tsx` with the route heading shell and `CommunityFeedSkeleton`. Add shimmer styles and disable shimmer in the existing reduced-motion media query.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm test:e2e
pnpm --filter @iride/web lint
pnpm --filter @iride/web typecheck
pnpm --filter @iride/web test
git add 'apps/web/src/app/(main)/_components/route-focus-manager.tsx' 'apps/web/src/app/(main)/_components/page-skeletons.tsx' 'apps/web/src/app/(main)/_components/app-shell.tsx' 'apps/web/src/app/(main)/community/loading.tsx' apps/web/src/app/globals.css tests/e2e/navigation.spec.ts
git commit -m "feat(web): add route focus and skeleton foundation"
```

Expected: all commands exit 0 before commit.

### Task 5: Foundation checkpoint

**Files:**

- Modify only files from Tasks 1–4 if verification identifies a defect.

**Interfaces:**

- Verifies the public interfaces required by later plans.

- [ ] **Step 1: Run the slice verification**

```powershell
pnpm --filter @iride/web lint
pnpm --filter @iride/web typecheck
pnpm --filter @iride/web test
pnpm test:e2e
git diff --check HEAD~4..HEAD
git status --short
```

Expected: all commands exit 0, no whitespace errors, and a clean working tree.

- [ ] **Step 2: Stop for review**

Review this independently testable foundation before starting the progressive-data plan. Apply review fixes in a dedicated commit on the same branch.
