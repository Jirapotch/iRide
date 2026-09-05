# Matcha Map Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-ready Mint / Matcha Latte UI refinement with a calmer MapLibre basemap, responsive selection panels, purposeful GSAP coordination, and pull-request CI while preserving iRide behavior.

**Architecture:** Keep Server Components and existing data flows unchanged. Add pure, unit-tested map styling and camera/motion policy helpers, consume them only inside the existing route-scoped `ActivityHub` Client Component, and use CSS tokens for the rest of the product. Extend Playwright coverage for visible responsive behavior and GitHub Actions for repository-wide validation.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5.9, MapLibre GL 6.6, GSAP 3, Tailwind CSS 4/global CSS, Vitest 4, Playwright 1.62, pnpm 11.19, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-06-matcha-map-motion-design.md`

## Global Constraints

- Preserve all existing routes, API contracts, business logic, MapLibre sources, content layers, auth behavior, and permissions.
- Use the approved palette values from the spec and keep the dark theme coherent rather than forcing light surfaces.
- Inspect real runtime layers through `map.getStyle()`; never hard-code vendor layer IDs that the loaded style does not expose.
- MapLibre owns camera movement; GSAP coordinates DOM state only.
- CSS handles simple UI transitions. No ScrollTrigger, Flip, ambient animation, continuous route animation, or map-canvas transform.
- Reduced motion removes stagger and animated camera travel without removing information.
- New production behavior follows red-green-refactor; configuration-only files are verified by repository checks.

---

### Task 1: Coherent product and motion tokens

**Files:**
- Modify: `apps/web/src/shared/theme/tokens.ts`
- Modify: `apps/web/src/app/globals.css`
- Test: `apps/web/src/shared/theme/tokens.test.ts`

**Interfaces:**
- Consumes: Ant Design `ThemeConfig` and current CSS custom properties.
- Produces: `matchaPalette`, `motionTokens`, and `createThemeConfig(mode)` values shared by component and CSS styling.

- [ ] **Step 1: Write failing token tests**

```ts
import { describe, expect, it } from "vitest";
import { createThemeConfig, matchaPalette, motionTokens } from "./tokens";

describe("Matcha design tokens", () => {
  it("exports the approved semantic palette", () => {
    expect(matchaPalette).toMatchObject({ primary: "#6F8F72", deep: "#4F6F52", cream: "#F6F3E8", ink: "#27322A" });
  });

  it("keeps restrained shared motion timing", () => {
    expect(motionTokens).toEqual({ fast: 0.16, base: 0.28, slow: 0.45, offsetSmall: 8, offsetMedium: 16, offsetLarge: 24 });
  });

  it("maps light and dark Ant Design surfaces coherently", () => {
    expect(createThemeConfig("light").token).toMatchObject({ colorPrimary: "#6F8F72", colorBgBase: "#F6F3E8", colorTextBase: "#27322A" });
    expect(createThemeConfig("dark").token).toMatchObject({ colorPrimary: "#BFD8C2", colorBgBase: "#18231E" });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm --filter @iride/web test -- src/shared/theme/tokens.test.ts`

Expected: FAIL because `matchaPalette` and `motionTokens` are not exported and the current token values differ.

- [ ] **Step 3: Implement shared TS and CSS tokens**

Export the exact palette and motion values asserted above, use them in `createThemeConfig`, and replace residual blue/black shell, focus, field, premium-card, and overlay values with semantic CSS variables. Add `--motion-fast`, `--motion-base`, `--motion-slow`, `--ease-standard`, `--ease-emphasized`, and offset variables in both themes. Keep all existing selectors and behavior.

- [ ] **Step 4: Run focused and full web unit tests**

Run: `pnpm --filter @iride/web test -- src/shared/theme/tokens.test.ts && pnpm --filter @iride/web test`

Expected: PASS with 20 test files and 108 tests or more.

- [ ] **Step 5: Commit the token slice**

```bash
git add apps/web/src/shared/theme/tokens.ts apps/web/src/shared/theme/tokens.test.ts apps/web/src/app/globals.css
git commit -m "feat(web): unify matcha design tokens"
```

### Task 2: Calm MapLibre vector and raster styling

**Files:**
- Modify: `apps/web/src/lib/map-palette.ts`
- Modify: `apps/web/src/lib/map-palette.test.ts`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Consumes: `Map.getStyle()` and `Map.setPaintProperty(layerId, property, value)` from the existing live map.
- Produces: `applyMapPalette(map, theme)` that styles only returned layers, including the real fallback `osm` raster layer.

- [ ] **Step 1: Replace palette expectations with failing Matcha tests**

Add assertions that the semantic map palette uses cream ground, soft-mint water, sage parks, warm-white roads, beige buildings, charcoal-green labels, and a deep-matcha raster veil. Extend the fake map with `{ id: "osm", type: "raster" }` and assert calls for `raster-saturation`, `raster-contrast`, `raster-brightness-max`, and `raster-opacity`. Assert symbol styling includes text halo but reduces icon opacity only when the real symbol layer is returned.

- [ ] **Step 2: Run the map palette test and confirm RED**

Run: `pnpm --filter @iride/web test -- src/lib/map-palette.test.ts`

Expected: FAIL because the current Natural Mist values are too vivid and raster layers are classified but not styled.

- [ ] **Step 3: Implement the minimal runtime-layer styling**

Keep regex classification against each actual `layer.id` returned at runtime. Use explicit semantic branches for ground, park/forest, building/urban, water/waterway, road/bridge/tunnel, casing/boundary, label, and raster types, and set only paint properties valid for the returned layer type inside the existing guarded setter. Do not change `mapStyle()` or either source URL.

- [ ] **Step 4: Run map tests and web unit suite**

Run: `pnpm --filter @iride/web test -- src/lib/map-palette.test.ts src/lib/app-navigation-domain.test.ts && pnpm --filter @iride/web test`

Expected: PASS; the fallback style contract remains `{ id: "osm", type: "raster", source: "osm" }`.

- [ ] **Step 5: Commit map styling**

```bash
git add apps/web/src/lib/map-palette.ts apps/web/src/lib/map-palette.test.ts apps/web/src/app/globals.css
git commit -m "feat(web): calm MapLibre basemap styling"
```

### Task 3: Responsive camera and motion policy

**Files:**
- Create: `apps/web/src/lib/map-motion.ts`
- Create: `apps/web/src/lib/map-motion.test.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `{ longitude, latitude }`, viewport width/height, and `reducedMotion`.
- Produces: `mapSelectionCamera(feature, viewport, reducedMotion): { center; duration; essential; padding }`, `motionTokens`, and `shouldAnimateMap(reducedMotion)` for `ActivityHub`.

- [ ] **Step 1: Write failing camera-policy tests**

```ts
import { describe, expect, it } from "vitest";
import { mapSelectionCamera } from "./map-motion";

const feature = { longitude: 100.5018, latitude: 13.7563 };

describe("map selection camera", () => {
  it("reserves a desktop side panel", () => {
    expect(mapSelectionCamera(feature, { width: 1280, height: 900 }, false)).toEqual({ center: [100.5018, 13.7563], duration: 420, essential: false, padding: { top: 80, right: 420, bottom: 80, left: 80 } });
  });

  it("reserves a mobile bottom sheet", () => {
    expect(mapSelectionCamera(feature, { width: 390, height: 844 }, false).padding.bottom).toBe(380);
  });

  it("makes camera movement instant for reduced motion", () => {
    expect(mapSelectionCamera(feature, { width: 1280, height: 900 }, true).duration).toBe(0);
  });
});
```

- [ ] **Step 2: Run the camera-policy test and confirm RED**

Run: `pnpm --filter @iride/web test -- src/lib/map-motion.test.ts`

Expected: FAIL because `map-motion.ts` does not exist.

- [ ] **Step 3: Implement policy and add route-scoped GSAP**

Create the pure helper to satisfy the tests. Install only `gsap` in `@iride/web` with `pnpm --filter @iride/web add gsap`; do not add GSAP plugins or a global animation provider.

- [ ] **Step 4: Run focused tests and inspect dependency delta**

Run: `pnpm --filter @iride/web test -- src/lib/map-motion.test.ts && git diff -- apps/web/package.json pnpm-lock.yaml`

Expected: PASS and lockfile changes limited to GSAP.

- [ ] **Step 5: Commit motion policy**

```bash
git add apps/web/src/lib/map-motion.ts apps/web/src/lib/map-motion.test.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add map motion policy"
```

### Task 4: Marker, camera, filter, controls, and responsive panel UX

**Files:**
- Modify: `apps/web/src/app/(main)/_components/activity-hub.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `tests/e2e/premium-ui.spec.ts`

**Interfaces:**
- Consumes: `mapSelectionCamera`, MapLibre `easeTo`, real marker elements, existing `FeatureSheet`, and route-scoped `gsap`.
- Produces: desktop side panel, mobile bottom sheet, camera padding, result-count status, styled MapLibre control cluster, and cleaned-up entrance/selection timelines.

- [ ] **Step 1: Add failing E2E assertions**

Extend the mocked map tests to assert: a visible result count; compass and fullscreen controls on desktop; selected marker scale near `1.08`; desktop dialog aligned to the right and vertically below the header rather than pinned to the bottom; mobile dialog height no more than 52% with visible map context; filter trigger pressed state; and reduced motion producing a zero-duration selection camera exposed through `data-camera-duration` on the map region for deterministic verification.

- [ ] **Step 2: Run the focused E2E tests and confirm RED**

Run: `pnpm test:e2e -- --grep "maps renders|desktop marker detail|mobile marker detail|reduced motion"`

Expected: FAIL on result count, control availability, desktop side-panel geometry, and camera-duration signal.

- [ ] **Step 3: Implement the integrated selection flow**

In `ActivityHub`, add Navigation Control with compass and Fullscreen Control, keep the existing locate behavior, and expose a concise textual result/loading status. On selection, call `map.easeTo(mapSelectionCamera(...))`; create one GSAP context that sequences marker feedback, the side/bottom panel reveal, and inner content stagger. Use `matchMedia("(prefers-reduced-motion: reduce)")` to skip the timeline and camera travel. Revert the context on selection change/unmount. Preserve focus trapping and restoration exactly.

- [ ] **Step 4: Implement responsive and CSS-only interaction styling**

Use CSS for hover/focus/filter/nav state, controls, markers, loading/error crossfade, and all non-sequenced interactions. At `min-width: 1024px`, make `.activity-sheet` a fixed side panel between header and viewport bottom, remove the modal-like full backdrop obstruction while keeping outside-click semantics, and reserve camera right padding. Below that breakpoint retain the bottom sheet and fixed backdrop, clearing the mobile navigation. Use minimum 44px controls, semantic tokens, and the approved shadows/radii.

- [ ] **Step 5: Run focused unit/E2E and browser regression checks**

Run: `pnpm --filter @iride/web test && pnpm test:e2e -- --grep "maps renders|map chrome|mobile discover map|mobile marker detail|desktop marker detail|tablet marker detail|marker detail moves|portaled marker detail|has no horizontal overflow"`

Expected: PASS with no console errors and all existing focus/overflow behavior retained.

- [ ] **Step 6: Commit integrated map UX**

```bash
git add apps/web/src/app/(main)/_components/activity-hub.tsx apps/web/src/app/globals.css tests/e2e/premium-ui.spec.ts
git commit -m "feat(web): coordinate premium map interactions"
```

### Task 5: Global polish, CI workflow, and full verification

**Files:**
- Modify: `apps/web/src/app/(main)/page.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `tests/e2e/premium-ui.spec.ts`
- Create: `.github/workflows/pull-request.yml`
- Modify: `docs/ui-migration-notes.md`

**Interfaces:**
- Consumes: existing home/category markup and root `pnpm` scripts.
- Produces: refined responsive home hierarchy, documented UX/motion decisions, and deterministic pull-request validation.

- [ ] **Step 1: Add failing global visual-behavior assertions**

In `premium-ui.spec.ts`, assert 16px minimum computed body copy size, visible keyboard focus on primary navigation, home cards that fit the 360px viewport without uniform oversized empty space, and no horizontal overflow at existing target widths.

- [ ] **Step 2: Run the focused E2E assertions and confirm RED**

Run: `pnpm test:e2e -- --grep "home|horizontal overflow|keyboard focus|body copy"`

Expected: FAIL on current small text and uniform mobile card geometry.

- [ ] **Step 3: Apply minimal global polish**

Add data hooks only where needed and refine home typography, spacing, category-card hierarchy, dark surfaces, focus-visible styles, fields, feedback states, and responsive density. Do not add routes, content, cards, images, or business behavior.

- [ ] **Step 4: Add pull-request CI configuration**

Create `.github/workflows/pull-request.yml` for `pull_request` to `main` with `contents: read`, concurrency cancellation, Ubuntu, Node 24, pnpm 11.19.0, frozen install, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

- [ ] **Step 5: Document the completed UX system**

Update `docs/ui-migration-notes.md` with baseline issues, color tokens, exact MapLibre layer classes changed, GSAP sequences and rationale, CSS-only interactions, responsive/reduced-motion behavior, performance choices, and remaining limits (including that live marker data needs configured API services during local manual preview).

- [ ] **Step 6: Run full verification**

Run: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and the targeted Playwright suite with required local services.

Expected: every command exits 0; build output has no new warnings; MapLibre and GSAP remain route scoped.

- [ ] **Step 7: Capture final mobile and desktop screenshots**

Start the web preview, capture `/`, `/maps`, filters, and mocked marker detail at `390x844` and `1440x1000`, inspect each saved image, and compare against the baseline audit.

- [ ] **Step 8: Commit delivery files**

```bash
git add .github/workflows/pull-request.yml apps/web/src/app/(main)/page.tsx apps/web/src/app/globals.css tests/e2e/premium-ui.spec.ts docs/ui-migration-notes.md docs/superpowers
git commit -m "ci: verify pull request quality"
```

- [ ] **Step 9: Push, open PR, and merge after checks**

Push `codex/matcha-map-motion`, open a PR to `main` with the audit and verification summary, wait for required checks, and request the action-time confirmation immediately before creating/merging through browser UI if no authenticated CLI/API is available.
