# Navigation History and State Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Search, Admin, Profile, Community modal, and Map context across navigation and browser Back while providing explicit section retry behavior.

**Architecture:** Restorable view state is encoded in canonical URL parameters through pure helpers. Client-only view changes use the documented native History API integration to avoid unnecessary RSC requests. Detail pages carry a sanitized parent URL and expose a history-first Back control with a canonical fallback.

**Tech Stack:** Next.js 16.3.1 App Router and native History API integration, React 19.2.8, TypeScript 5.9, Vitest 4, Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-09-06-navigation-ux-loading-breadcrumb-design.md`

**Depends on:** `2026-09-06-navigation-ux-01-foundation.md` and `2026-09-06-navigation-ux-02-streaming-errors.md`.

## Global Constraints

- Execute plans 01 and 02 first.
- State that changes the restorable view belongs in the URL.
- Query-only updates must not steal focus or scroll to the top.
- Browser Back is preferred for an in-app detail origin; direct entry has a safe canonical fallback.
- Sanitize any supplied return path with the existing local-path validation.
- Do not use undocumented Next.js history-state fields.
- Do not add a custom scroll store unless the native restoration E2E test fails.

---

### Task 1: Canonical URL-state helpers

**Files:**

- Modify: `apps/web/src/lib/app-navigation-domain.ts:1`
- Modify: `apps/web/src/lib/app-navigation-domain.test.ts:1`

**Interfaces:**

- Produces: `searchHref`, `adminUsersHref`, `adminUserDetailHref`, `parseMapKinds`, and `mapStateHref`.
- Map kind order is canonical: `meeting,event,trip`.

- [ ] **Step 1: Write failing helper tests**

```ts
it("serializes restorable search and admin state", () => {
  expect(searchHref("  maya  ")).toBe("/search?q=maya");
  expect(searchHref(" ")).toBe("/search");
  expect(adminUsersHref({ q: "locked rider", page: 2 })).toBe(
    "/settings/users?q=locked+rider&page=2",
  );
  expect(adminUserDetailHref("u/1", "/settings/users?q=locked&page=2")).toBe(
    "/settings/users/u%2F1?from=%2Fsettings%2Fusers%3Fq%3Dlocked%26page%3D2",
  );
});

it("round-trips canonical map filters and selection", () => {
  expect(parseMapKinds("trip,meeting,unknown")).toEqual(["meeting", "trip"]);
  expect(parseMapKinds(null)).toEqual(["meeting", "event", "trip"]);
  expect(parseMapKinds("")).toEqual([]);
  expect(mapStateHref({ kinds: [] })).toBe("/maps?layers=");
  expect(mapStateHref({ kinds: ["trip", "meeting"], marker: "event-1" })).toBe(
    "/maps?layers=meeting%2Ctrip&marker=event-1",
  );
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm --filter @iride/web test -- src/lib/app-navigation-domain.test.ts
```

Expected: FAIL because the helpers are absent.

- [ ] **Step 3: Implement helpers**

```ts
const mapKindOrder = ["meeting", "event", "trip"] as const;
export type MapKind = (typeof mapKindOrder)[number];

export function searchHref(query: string): string {
  const value = query.trim();
  return value ? `/search?${new URLSearchParams({ q: value })}` : "/search";
}

export function adminUsersHref({
  q,
  page,
}: {
  readonly q: string;
  readonly page: number;
}): string {
  const query = new URLSearchParams();
  if (q.trim()) query.set("q", q.trim());
  if (page > 1) query.set("page", String(page));
  return query.size ? `/settings/users?${query}` : "/settings/users";
}

export function adminUserDetailHref(id: string, from: string): string {
  return `/settings/users/${encodeURIComponent(id)}?${new URLSearchParams({ from })}`;
}

export function parseMapKinds(value: string | null | undefined): MapKind[] {
  if (value == null) return [...mapKindOrder];
  if (value === "") return [];
  const selected = new Set(value.split(","));
  const parsed = mapKindOrder.filter((kind) => selected.has(kind));
  return parsed.length ? parsed : [...mapKindOrder];
}

export function mapStateHref({
  kinds,
  marker,
  modal,
}: {
  readonly kinds: readonly MapKind[];
  readonly marker?: string | null;
  readonly modal?: string | null;
}): string {
  const query = new URLSearchParams();
  const ordered = mapKindOrder.filter((kind) => kinds.includes(kind));
  if (ordered.length !== mapKindOrder.length)
    query.set("layers", ordered.join(","));
  if (marker) query.set("marker", marker);
  if (modal) query.set("modal", modal);
  return query.size ? `/maps?${query}` : "/maps";
}
```

- [ ] **Step 4: Verify GREEN and commit**

```powershell
pnpm --filter @iride/web test -- src/lib/app-navigation-domain.test.ts
git add apps/web/src/lib/app-navigation-domain.ts apps/web/src/lib/app-navigation-domain.test.ts
git commit -m "feat(web): add canonical navigation state URLs"
```

Expected: test exits 0 before commit.

### Task 2: Search URL restoration, loading rows, and Retry

**Files:**

- Modify: `apps/web/src/app/(main)/search/page.tsx:1`
- Modify: `apps/web/src/app/(main)/_components/search-screen.tsx:1`
- Modify: `apps/web/src/app/globals.css:1700`
- Modify: `tests/e2e/navigation.spec.ts:1`

**Interfaces:**

- `SearchPage` supplies `initialQuery` from `searchParams.q`.
- `SearchScreen` keeps the input synchronized with URL Back/Forward and retries by incrementing a local request version.

- [ ] **Step 1: Write failing restoration and recovery tests**

```ts
test("browser Back restores search query and focus context", async ({
  page,
}) => {
  await page.goto("/search?q=ride");
  const input = page.getByRole("textbox", { name: "Search" });
  await expect(input).toHaveValue("ride");
  await page.getByRole("link", { name: "Home" }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/search\?q=ride$/);
  await expect(input).toHaveValue("ride");
});

test("failed search offers retry without clearing the query", async ({
  page,
}) => {
  await page.route("**/api/v1/search?**", (route) => route.abort());
  await page.goto("/search?q=ride");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search" })).toHaveValue(
    "ride",
  );
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm test:e2e
```

Expected: FAIL because the page ignores `q` and the error has no Retry control.

- [ ] **Step 3: Initialize and synchronize query state**

Change the page signature to await `searchParams` and pass a capped `initialQuery`:

```tsx
export default async function SearchPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string }>;
}) {
  const [locale, query] = await Promise.all([getRequestLocale(), searchParams]);
  return (
    <SearchScreen initialQuery={query.q?.slice(0, 100) ?? ""} locale={locale} />
  );
}
```

In `SearchScreen`, initialize from `initialQuery`, read `useSearchParams()`, and synchronize on Back/Forward. After the existing 250 ms debounce, call `window.history.replaceState(null, "", searchHref(value))` before starting the request. Do not call `router.push` for each keystroke.

- [ ] **Step 4: Add visible loading rows and Retry**

While `loading`, render three fixed-height result skeleton rows inside the existing `aria-busy` region. On failure render:

```tsx
<div className="search-error" role="alert">
  <p>{locale === "th" ? "ค้นหาไม่สำเร็จ" : "Search failed."}</p>
  <button onClick={() => setRequestVersion((value) => value + 1)} type="button">
    {locale === "th" ? "ลองอีกครั้ง" : "Retry"}
  </button>
</div>
```

Include `requestVersion` in the request effect dependencies. Abort or ignore stale requests using the existing `current` cleanup flag. Do not show “No results found” while loading.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --filter @iride/web typecheck
pnpm test:e2e
git add 'apps/web/src/app/(main)/search/page.tsx' 'apps/web/src/app/(main)/_components/search-screen.tsx' apps/web/src/app/globals.css tests/e2e/navigation.spec.ts
git commit -m "feat(web): preserve and recover search state"
```

Expected: commands exit 0 before commit.

### Task 3: History-aware Admin detail return

**Files:**

- Create: `apps/web/src/app/(main)/_components/history-back-button.tsx`
- Modify: `apps/web/src/lib/auth-redirect.ts:14`
- Modify: `apps/web/src/lib/auth-redirect.test.ts:1`
- Modify: `apps/web/src/features/admin/admin-user-directory.tsx:1`
- Modify: `apps/web/src/app/(main)/settings/users/page.tsx:1`
- Modify: `apps/web/src/app/(main)/settings/users/[id]/page.tsx:1`
- Modify: `tests/e2e/navigation.spec.ts:1`

**Interfaces:**

- Adds `safeReturnPath(value, fallback = "/")` without changing existing callers.
- Produces `<HistoryBackButton fallbackHref label originKey />`.
- `AdminUserDirectory` consumes `returnHref`, includes it in every detail destination, and records same-tab entry in `sessionStorage` under a fixed origin key.

- [ ] **Step 1: Write failing domain and E2E tests**

```ts
it("uses a caller supplied safe return fallback", () => {
  expect(safeReturnPath("https://evil.example", "/settings/users")).toBe(
    "/settings/users",
  );
});
```

```ts
test("admin detail returns to the exact filtered list", async ({ page }) => {
  await page.goto("/login?next=%2Fsettings%2Fusers%3Fq%3Dlocked%26page%3D1");
  await page.getByRole("button", { name: /Google/ }).click();
  await page.getByRole("link", { name: /Locked Rider/ }).click();
  await page.getByRole("button", { name: "Back to user list" }).click();
  await expect(page).toHaveURL(/\/settings\/users\?q=locked/);
  await expect(page.getByRole("textbox", { name: "Search users" })).toHaveValue(
    "locked",
  );
});

test("a directly opened admin detail uses its safe fallback", async ({
  page,
}) => {
  const next = encodeURIComponent(
    "/settings/users/22222222-2222-4222-8222-222222222222?from=/settings/users?q=locked",
  );
  await page.goto(`/login?next=${next}`);
  await page.getByRole("button", { name: /Google/ }).click();
  await page.getByRole("button", { name: "Back to user list" }).click();
  await expect(page).toHaveURL(/\/settings\/users\?q=locked$/);
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm --filter @iride/web test -- src/lib/auth-redirect.test.ts
pnpm test:e2e
```

Expected: FAIL because the helper accepts no fallback and detail hardcodes `/settings/users`.

- [ ] **Step 3: Implement safe fallback and Back control**

```ts
export function safeReturnPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  return safeLocalPath(value, fallback);
}
```

```tsx
"use client";

import { useRouter } from "next/navigation";

export function HistoryBackButton({
  fallbackHref,
  label,
  originKey,
}: {
  readonly fallbackHref: string;
  readonly label: string;
  readonly originKey: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        const cameFromList =
          window.sessionStorage.getItem(originKey) === fallbackHref;
        if (cameFromList) {
          window.sessionStorage.removeItem(originKey);
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      type="button"
    >
      ← {label}
    </button>
  );
}
```

- [ ] **Step 4: Carry the list context**

The list page computes `returnHref = adminUsersHref({ q, page })` and passes it to `AdminUserDirectory`. Row links use `adminUserDetailHref(user.id, returnHref)`. For an unmodified same-tab click only, their click handler stores `returnHref` as `iride:admin-users-origin`; modifier clicks and new-tab gestures do not write it. Detail parses `query.from` with `safeReturnPath(query.from, "/settings/users")`, uses that href for the breadcrumb parent, and passes the fixed origin key to `HistoryBackButton`. A copied/direct detail URL therefore uses `router.push(fallbackHref)`, while a genuine list-to-detail visit uses `router.back()`.

Preserve `from` through `changeUserAccess` and `removeAdminContent` hidden inputs and redirects so mutation completion does not discard return context.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --filter @iride/web test -- src/lib/auth-redirect.test.ts src/lib/app-navigation-domain.test.ts
pnpm --filter @iride/web typecheck
pnpm test:e2e
git add 'apps/web/src/app/(main)/_components/history-back-button.tsx' apps/web/src/lib/auth-redirect.ts apps/web/src/lib/auth-redirect.test.ts apps/web/src/features/admin/admin-user-directory.tsx 'apps/web/src/app/(main)/settings/users' 'apps/web/src/app/(main)/_components/breadcrumbs.tsx' tests/e2e/navigation.spec.ts
git commit -m "feat(web): preserve admin list context"
```

Expected: commands exit 0 before commit.

### Task 4: Map URL state and section retry

**Files:**

- Modify: `apps/web/src/app/(main)/maps/page.tsx:1`
- Modify: `apps/web/src/app/(main)/_components/activity-hub.tsx:23`
- Modify: `tests/e2e/premium-ui.spec.ts:1`

**Interfaces:**

- `ActivityHub` initializes enabled kinds from `layers` and synchronizes marker/filter changes through `mapStateHref`.
- Map errors keep the canvas and expose a Retry button that re-runs `loadViewport`.

- [ ] **Step 1: Write failing state and retry tests**

```ts
test("map marker and filters survive browser Back", async ({ page }) => {
  await page.route("**/api/explore?**", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "marker-1",
            kind: "meeting",
            title: "Test meeting",
            subtitle: "Bangkok",
            latitude: 13.7563,
            longitude: 100.5018,
            startsAt: "2026-09-01T06:00:00.000Z",
            endsAt: null,
            author: { id: "author-1", username: "rider", displayName: "Rider" },
            canEdit: false,
          },
        ],
      }),
    }),
  );
  await page.goto("/maps?layers=meeting%2Ctrip");
  await page.getByRole("button", { name: "Filter markers" }).click();
  await expect(page.getByRole("checkbox", { name: "Event" })).not.toBeChecked();
  await page.getByRole("button", { name: "Test meeting" }).click();
  await expect(page).toHaveURL(/marker=marker-1/);
  await page.goto("/");
  await page.goBack();
  await expect(page).toHaveURL(/layers=meeting%2Ctrip/);
  await expect(
    page.getByRole("dialog", { name: "Test meeting" }),
  ).toBeVisible();
});

test("map marker failure offers retry without hiding the map", async ({
  page,
}) => {
  await page.route("**/api/explore?**", (route) => route.abort());
  await page.goto("/maps");
  await expect(page.getByText("Markers could not load")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry markers" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Discover map" }),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm test:e2e
```

Expected: FAIL because enabled kinds start from constants, marker clicks do not update the URL, and no Retry button exists.

- [ ] **Step 3: Synchronize Map state with the URL**

Initialize `enabled` with `parseMapKinds(params.get("layers"))`. When a marker is selected, call `window.history.pushState(null, "", mapStateHref({ kinds: enabledRef.current, marker: feature.id }))` before `setSelectedId`. When filters change, call `window.history.replaceState` with the canonical kinds and current marker. Add an effect that rehydrates `selectedId` and enabled kinds when `useSearchParams()` changes through Back/Forward.

Closing a sheet opened from a pushed marker state calls `window.history.back()`; a direct-entry marker URL replaces to the same filter URL without `marker`. Preserve existing focus restoration to the marker trigger.

- [ ] **Step 4: Add Retry**

In the current non-blocking map error region, add:

```tsx
<button
  disabled={loading}
  onClick={() => {
    const map = mapRef.current;
    if (map) void loadViewport(map);
  }}
  type="button"
>
  {locale === "th" ? "ลองโหลด marker อีกครั้ง" : "Retry markers"}
</button>
```

Keep the existing request abort behavior so rapid retry or map movement cannot race stale results into state.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --filter @iride/web test -- src/lib/app-navigation-domain.test.ts
pnpm --filter @iride/web typecheck
pnpm test:e2e
git add 'apps/web/src/app/(main)/maps/page.tsx' 'apps/web/src/app/(main)/_components/activity-hub.tsx' tests/e2e/premium-ui.spec.ts
git commit -m "feat(web): preserve map navigation context"
```

Expected: commands exit 0 before commit.

### Task 5: Native scroll restoration checkpoint

**Files:**

- Modify: `tests/e2e/navigation.spec.ts:1`
- Modify product code only if the native browser/Next.js behavior fails this test.

**Interfaces:**

- Proves that URL-preserving list/detail navigation is sufficient for scroll restoration.

- [ ] **Step 1: Add the long-list Back test**

```ts
test("browser Back restores the filtered list scroll position", async ({
  page,
}) => {
  await page.goto("/login?next=%2Fsettings%2Fusers%3Fq%3Drider");
  await page.getByRole("button", { name: /Google/ }).click();
  await page.addStyleTag({
    content: ".admin-user-table { margin-top: 1200px; }",
  });
  const detailLink = page.getByRole("link", { name: /Rider/ }).first();
  await detailLink.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  );
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(200);
  await detailLink.click();
  await page.getByRole("button", { name: "Back to user list" }).click();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThanOrEqual(before - 2);
});
```

- [ ] **Step 2: Run and verify behavior**

```powershell
pnpm test:e2e
```

Expected after Tasks 1–4: PASS using native restoration. If RED, first remove any `replace` or forced scroll behavior that destroys the list history entry. Add a keyed session scroll cache only after proving native restoration still fails.

- [ ] **Step 3: Commit the acceptance test**

```powershell
git add tests/e2e/navigation.spec.ts
git commit -m "test(web): cover list scroll restoration"
```

- [ ] **Step 4: Run the slice checkpoint**

```powershell
pnpm --filter @iride/web lint
pnpm --filter @iride/web typecheck
pnpm --filter @iride/web test
pnpm test:e2e
git diff --check HEAD~5..HEAD
git status --short
```

Expected: all commands exit 0 and the working tree is clean before the polish plan.
