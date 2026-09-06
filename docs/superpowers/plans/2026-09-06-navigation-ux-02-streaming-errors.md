# Progressive Rendering and Error Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Community, Profile, Create, and Admin destinations render useful structure before independent data resolves and distinguish API failures from valid empty data.

**Architecture:** Required identity or authorization reads remain gates. Independent content reads move into focused async Server Components behind Suspense, returning explicit success/error results to compact section recovery UI. Profile joins the persistent `(main)` shell without changing its public URL.

**Tech Stack:** Next.js 16.3.1 Server Components and Suspense, React 19.2.8, TypeScript 5.9, Vitest 4, Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-09-06-navigation-ux-loading-breadcrumb-design.md`

**Depends on:** `2026-09-06-navigation-ux-01-foundation.md`.

## Global Constraints

- Execute `2026-09-06-navigation-ux-01-foundation.md` first.
- Preserve authentication and authorization decisions.
- An API failure must never render as a legitimate empty collection.
- The shared shell, breadcrumb, heading, and available controls remain usable during loading and errors.
- Do not add client-side fetching merely to avoid Server Components.
- Do not add a global loading overlay or new dependency.
- Follow `apps/web/AGENTS.md` and local Next.js streaming/error documentation.

---

### Task 1: Explicit server data result and retry UI

**Files:**

- Create: `apps/web/src/lib/data-result.ts`
- Create: `apps/web/src/lib/data-result.test.ts`
- Create: `apps/web/src/app/(main)/_components/section-error.tsx`
- Modify: `apps/web/src/app/globals.css:2420`

**Interfaces:**

- Produces: `DataResult<T>`, `captureData(read)`, and `<SectionError title message />`.
- `captureData` preserves successful empty arrays as success and converts thrown reads to error without logging secrets.

- [ ] **Step 1: Write the failing unit tests**

```ts
import { describe, expect, it } from "vitest";

import { captureData } from "./data-result";

describe("captureData", () => {
  it("keeps a successful empty collection distinct from failure", async () => {
    await expect(captureData(async () => [])).resolves.toEqual({
      status: "success",
      data: [],
    });
  });

  it("returns an error state when the read throws", async () => {
    await expect(
      captureData(async () => {
        throw new Error("offline");
      }),
    ).resolves.toEqual({ status: "error" });
  });
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm --filter @iride/web test -- src/lib/data-result.test.ts
```

Expected: FAIL because `data-result.ts` does not exist.

- [ ] **Step 3: Implement the result boundary**

```ts
export type DataResult<T> =
  | { readonly status: "success"; readonly data: T }
  | { readonly status: "error" };

export async function captureData<T>(
  read: () => Promise<T>,
): Promise<DataResult<T>> {
  try {
    return { status: "success", data: await read() };
  } catch {
    return { status: "error" };
  }
}
```

Create `SectionError` as a Client Component using `useRouter().refresh()`:

```tsx
"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

export function SectionError({
  title,
  message,
  retryLabel,
}: {
  readonly title: string;
  readonly message: string;
  readonly retryLabel: string;
}) {
  const router = useRouter();
  return (
    <section className="section-error" role="alert">
      <WarningCircle aria-hidden size={20} />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <button onClick={() => router.refresh()} type="button">
        {retryLabel}
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Run and verify GREEN**

```powershell
pnpm --filter @iride/web test -- src/lib/data-result.test.ts
pnpm --filter @iride/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/data-result.ts apps/web/src/lib/data-result.test.ts 'apps/web/src/app/(main)/_components/section-error.tsx' apps/web/src/app/globals.css
git commit -m "feat(web): distinguish data errors from empty states"
```

### Task 2: Stream Community feed and edit data independently

**Files:**

- Create: `apps/web/src/app/(main)/_components/community-data-sections.tsx`
- Create: `apps/web/src/app/(main)/_components/community-data-sections.test.tsx`
- Modify: `apps/web/src/app/(main)/_components/community-feed-page.tsx:1`
- Modify: `apps/web/src/app/(main)/_components/community-screen.tsx:31`
- Modify: `apps/web/src/app/(main)/community/loading.tsx:1`
- Modify: `tests/e2e/navigation.spec.ts:1`

**Interfaces:**

- Produces: async `<CommunityFeedSection>` and `<CommunityEditRegion>`.
- `CommunityScreen` becomes the feed-only Client Component and no longer owns heading or edit-data fetching.

- [ ] **Step 1: Write a failing delayed E2E test and error-semantics unit test**

```ts
test("community shell appears before delayed feed data", async ({ page }) => {
  await page.route("**/community/car/talk", async (route) => {
    if (route.request().headers().rsc === "1")
      await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.goto("/community/car");
  await page.getByRole("link", { name: /Talk/ }).click({ noWaitAfter: true });
  await expect(page.getByRole("heading", { name: "Car talk" })).toBeVisible();
  await expect(
    page.locator('[data-ui="community-feed-skeleton"]'),
  ).toBeVisible();
});
```

In `community-data-sections.test.tsx`:

```ts
import { afterEach, expect, test, vi } from "vitest";

import { getPosts } from "@/lib/content-api";
import { CommunityFeedSection } from "./community-data-sections";
import { SectionError } from "./section-error";

vi.mock("@/lib/content-api", () => ({
  getEvents: vi.fn(),
  getPost: vi.fn(),
  getPosts: vi.fn(),
}));
vi.mock("@/lib/profile-api", () => ({ getOwnProfile: vi.fn() }));

afterEach(() => vi.clearAllMocks());

test("community API failure returns an error section, not an empty feed", async () => {
  vi.mocked(getPosts).mockRejectedValueOnce(new Error("offline"));

  const element = await CommunityFeedSection({
    accessToken: undefined,
    category: "car",
    locale: "en",
    room: "talk",
  });

  expect(element.type).toBe(SectionError);
  expect(element.props.title).toBe("Feed unavailable");
});
```

Place the Playwright test in `tests/e2e/navigation.spec.ts`. Place the Vitest test in `community-data-sections.test.tsx` exactly as separated above. This unit boundary is intentional: Playwright request routing cannot intercept the Server Component's server-to-server API request.

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm --filter @iride/web test -- community-data-sections.test.tsx
pnpm test:e2e
```

Expected: at least the error-semantics assertion fails because `getPosts(...).catch(() => [])` produces the empty state.

- [ ] **Step 3: Split the server data sections**

`CommunityFeedPage` resolves locale, session, query, heading, and breadcrumbs, then renders the feed boundary immediately:

```tsx
<div className="community-page">
  <Breadcrumbs items={items} />
  <header className="community-heading">
    <h1 data-route-heading tabIndex={-1}>
      {heading[locale]}
    </h1>
  </header>
  <Suspense fallback={<CommunityFeedSkeleton />}>
    <CommunityFeedSection
      accessToken={session?.accessToken}
      category={category}
      locale={locale}
      room={room}
    />
  </Suspense>
  {query.modal === "edit" && query.post ? (
    <Suspense fallback={<div aria-busy="true" className="modal-skeleton" />}>
      <CommunityEditRegion
        accessToken={session?.accessToken}
        category={category}
        locale={locale}
        postId={query.post}
      />
    </Suspense>
  ) : null}
</div>
```

`CommunityFeedSection` calls `captureData(() => Promise.all([getPosts(...), viewerRead]))`. Render `SectionError` on failure and the feed-only `CommunityScreen` on success. `CommunityEditRegion` calls `getPost(postId)` and `getEvents()` only when the edit URL is active; unauthorized edits retain the existing permission alert.

- [ ] **Step 4: Remove misleading catches and preserve current behavior**

Remove `getPosts(...).catch(() => [])` and `getEvents(...).catch(() => [])` from the page path. Keep comments as their existing client-side section, including their local loading and retry behavior. Preserve create/edit/delete permissions and modal focus handling.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --filter @iride/web test
pnpm --filter @iride/web typecheck
pnpm test:e2e
git add 'apps/web/src/app/(main)/_components/community-data-sections.tsx' 'apps/web/src/app/(main)/_components/community-data-sections.test.tsx' 'apps/web/src/app/(main)/_components/community-feed-page.tsx' 'apps/web/src/app/(main)/_components/community-screen.tsx' 'apps/web/src/app/(main)/community/loading.tsx' tests/e2e/navigation.spec.ts
git commit -m "feat(web): stream community data sections"
```

Expected: commands exit 0 before commit.

### Task 3: Move Profile into the persistent shell and load only the active tab

**Files:**

- Move: `apps/web/src/app/users/[username]/page.tsx` to `apps/web/src/app/(main)/users/[username]/page.tsx`
- Move: `apps/web/src/app/users/[username]/user-profile-screen.tsx` to `apps/web/src/app/(main)/users/[username]/user-profile-screen.tsx`
- Move: `apps/web/src/app/users/[username]/media-uploader.tsx` to `apps/web/src/app/(main)/users/[username]/media-uploader.tsx`
- Create: `apps/web/src/app/(main)/users/[username]/profile-tab-content.tsx`
- Create: `apps/web/src/app/(main)/users/[username]/profile-tab-content.test.tsx`
- Create: `apps/web/src/app/(main)/users/[username]/loading.tsx`
- Modify: `tests/e2e/profiles.spec.ts:1`

**Interfaces:**

- Produces: `<ProfileTabContent tab username accessToken ownerProfile canManage selectedVehicleId modal locale />`.
- `UserProfileScreen` consumes `tabContent: ReactNode` and no longer requires both `vehicles` and `activities` on every tab.

- [ ] **Step 1: Write failing shell and selective-tab tests**

```ts
test("profile navigation keeps the main shell mounted", async ({ page }) => {
  await page.goto("/login?next=%2F");
  await page.getByRole("button", { name: /Google/ }).click();
  const shell = page.locator('[data-ui="app-shell"]');
  await shell.evaluate((element) =>
    element.setAttribute("data-test-shell", "mounted"),
  );
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Profile" }).click();
  await expect(shell).toHaveAttribute("data-test-shell", "mounted");
});
```

In `profile-tab-content.test.tsx`:

```ts
import { afterEach, expect, test, vi } from "vitest";

import { getGarage, getProfileActivities } from "@/lib/content-api";
import { ProfileTabContent } from "./profile-tab-content";

vi.mock("@/lib/content-api", () => ({
  getGarage: vi.fn(),
  getProfileActivities: vi.fn(),
}));
vi.mock("./user-profile-screen", () => ({
  GaragePanel: () => null,
  ProfileActivities: () => null,
}));

afterEach(() => vi.clearAllMocks());

test("garage tab does not request activities", async () => {
  vi.mocked(getGarage).mockResolvedValueOnce([]);
  await ProfileTabContent({
    accessToken: "token",
    canManage: false,
    locale: "en",
    modal: undefined,
    ownerProfile: null,
    selectedVehicleId: undefined,
    tab: "garage",
    username: "e2e_rider",
  });
  expect(getGarage).toHaveBeenCalledOnce();
  expect(getProfileActivities).not.toHaveBeenCalled();
});
```

Keep the first test in `profiles.spec.ts`. Put the mocked data-access test in `profile-tab-content.test.tsx` with Vitest imports and an `afterEach(() => vi.clearAllMocks())`. The unit seam verifies server-side call selection directly; browser request events cannot observe those fetches.

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm --filter @iride/web test -- profile-tab-content.test.tsx
pnpm test:e2e
```

Expected: FAIL because Profile creates a second shell and loads garage plus activities together.

- [ ] **Step 3: Move the route without changing its URL**

```powershell
git mv 'apps/web/src/app/users/[username]/page.tsx' 'apps/web/src/app/(main)/users/[username]/page.tsx'
git mv 'apps/web/src/app/users/[username]/user-profile-screen.tsx' 'apps/web/src/app/(main)/users/[username]/user-profile-screen.tsx'
git mv 'apps/web/src/app/users/[username]/media-uploader.tsx' 'apps/web/src/app/(main)/users/[username]/media-uploader.tsx'
```

Remove the page-local `AppShell`. Update moved-file imports: app-level media/profile modules move from `../../...` to `../../../...`, and `(main)` components become `../../_components/...` or `../../create/...`. Await only session, public profile, and own profile before validating the identity. Render breadcrumbs and the profile header, then pass a Suspense-wrapped `ProfileTabContent` node into `UserProfileScreen`.

- [ ] **Step 4: Implement selective tab content**

```tsx
export async function ProfileTabContent(props: ProfileTabContentProps) {
  const text =
    props.locale === "th"
      ? {
          activitiesTitle: "โหลดกิจกรรมไม่ได้",
          activitiesMessage: "ไม่สามารถโหลดกิจกรรมที่เผยแพร่ได้",
          garageTitle: "โหลด Garage ไม่ได้",
          garageMessage: "ไม่สามารถโหลดข้อมูล Vehicle ได้",
          retry: "ลองอีกครั้ง",
        }
      : {
          activitiesTitle: "Activities unavailable",
          activitiesMessage: "Published activities could not load.",
          garageTitle: "Garage unavailable",
          garageMessage: "Vehicles could not load.",
          retry: "Retry",
        };
  if (props.tab === "activities") {
    const result = await captureData(() =>
      getProfileActivities(props.username, props.accessToken),
    );
    return result.status === "error" ? (
      <SectionError
        title={text.activitiesTitle}
        message={text.activitiesMessage}
        retryLabel={text.retry}
      />
    ) : (
      <ProfileActivities activities={result.data} locale={props.locale} />
    );
  }
  if (props.tab === "garage") {
    const result = await captureData(() =>
      getGarage(props.username, props.accessToken),
    );
    return result.status === "error" ? (
      <SectionError
        title={text.garageTitle}
        message={text.garageMessage}
        retryLabel={text.retry}
      />
    ) : (
      <GaragePanel
        canCreate={props.ownerProfile?.canWrite ?? false}
        canManage={props.canManage}
        locale={props.locale}
        modal={props.modal}
        selectedVehicleId={props.selectedVehicleId}
        username={props.username}
        vehicles={result.data}
      />
    );
  }
  return null;
}
```

Export the existing `ProfileActivities` and `GaragePanel` markup from the Client Component module. Keep overview markup in `UserProfileScreen`, and move garage modal ownership into `GaragePanel` so only the Garage tab needs vehicle data.

- [ ] **Step 5: Add the profile loading shell and verify**

`loading.tsx` renders `<ProfileSkeleton />`. The resolved heading uses `data-route-heading tabIndex={-1}` and the breadcrumb resolver receives the active tab and profile display name.

```powershell
pnpm --filter @iride/web typecheck
pnpm --filter @iride/web test
pnpm test:e2e
```

Expected: commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add -A -- 'apps/web/src/app/(main)/users' 'apps/web/src/app/users' tests/e2e/profiles.spec.ts
git commit -m "feat(web): stream profile tab content"
```

### Task 4: Route-level recovery and remaining loading coverage

**Files:**

- Create: `apps/web/src/app/(main)/error.tsx`
- Create: `apps/web/src/app/(main)/create/loading.tsx`
- Create: `apps/web/src/app/(main)/settings/users/loading.tsx`
- Create: `apps/web/src/app/(main)/settings/users/[id]/loading.tsx`
- Modify: `apps/web/src/app/(main)/create/page.tsx:12`
- Modify: `tests/e2e/navigation.spec.ts:1`

**Interfaces:**

- Produces: an App Router error boundary whose Retry button calls `reset()` and whose Back control links to `/`.
- Create keeps the access gate but streams marker options after the editable form structure is available.

- [ ] **Step 1: Add failing route recovery coverage**

```ts
test("a destination error keeps navigation available", async ({ page }) => {
  await page.goto("/login?next=%2Fsettings%2Fusers%2Fnot-a-user");
  await page.getByRole("button", { name: /Google/ }).click();
  await expect(page).toHaveURL(/\/settings\/users\/not-a-user$/);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
pnpm test:e2e
```

Expected: FAIL because no `(main)/error.tsx` recovery UI exists.

- [ ] **Step 3: Add the boundary**

```tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function MainError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="route-error" role="alert">
      <h1 data-route-heading tabIndex={-1}>
        This page could not load
      </h1>
      <p>Your navigation is still available. Retry this page or return home.</p>
      <div>
        <button onClick={reset} type="button">
          Retry
        </button>
        <Link href="/">Back home</Link>
      </div>
    </section>
  );
}
```

Localize copy using the existing locale mechanism before finishing this task; do not expose `error.message` or `digest` to users.

- [ ] **Step 4: Add loading files and stream Create options**

Use `AdminListSkeleton`, `AdminDetailSkeleton`, and a form-shaped skeleton in the new loading files. In Create, preserve session/profile permission checks, then render the form shell while an async marker-options child resolves `getEvents`; an unavailable marker list renders `SectionError` without hiding the form fields.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm --filter @iride/web lint
pnpm --filter @iride/web typecheck
pnpm --filter @iride/web test
pnpm test:e2e
git add 'apps/web/src/app/(main)/error.tsx' 'apps/web/src/app/(main)/create' 'apps/web/src/app/(main)/settings/users' tests/e2e/navigation.spec.ts
git commit -m "feat(web): add destination loading and recovery"
```

Expected: commands exit 0 before commit.

### Task 5: Progressive-rendering checkpoint

**Files:**

- Modify only files from Tasks 1–4 if verification identifies a defect.

**Interfaces:**

- Verifies explicit data states, section retry, persistent Profile shell, and route recovery.

- [ ] **Step 1: Run the full slice**

```powershell
pnpm --filter @iride/web lint
pnpm --filter @iride/web typecheck
pnpm --filter @iride/web test
pnpm test:e2e
git diff --check HEAD~4..HEAD
git status --short
```

Expected: all commands exit 0 and the working tree is clean.

- [ ] **Step 2: Stop for review**

Review this working progressive-rendering slice before starting URL/history state work. Apply fixes in a dedicated commit.
