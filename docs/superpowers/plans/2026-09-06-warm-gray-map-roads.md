# Warm Gray Map Roads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolor every vector road hierarchy to approved warm grays without changing marker, water, boundary, or raster-source behavior.

**Architecture:** Keep runtime classification in `map-palette.ts`, but distinguish road cores from road casings before broad edge matching and reject non-road transportation layers explicitly. Apply the two approved colors through the existing guarded `setPaintProperty` path so both app themes share identical behavior.

**Tech Stack:** TypeScript, MapLibre GL JS style layers, Vitest, Next.js 16, pnpm/Turborepo

**Spec:** `docs/superpowers/specs/2026-09-06-matcha-map-motion-design.md`, amended by the approved road colors in the delegated task.

## Global Constraints

- Road core color is `#D5D8D2` in both light and dark themes.
- Road casing/secondary line color is `#BEC4BC` in both light and dark themes.
- Keep marker colors, water color, and administrative boundary color unchanged.
- Cover motorway, trunk, primary, secondary, tertiary, and transportation road layers.
- Do not classify rail, transit, aerial transport, ferry, or administrative boundary layers as roads.
- Preserve the existing MapTiler Streets v2 URL and inline OSM raster fallback contract.
- Start from `origin/main` commit `70943394` so production API/login fixes remain intact.

---

### Task 1: Lock the road-layer regression in tests

**Files:**

- Modify: `apps/web/src/lib/map-palette.test.ts`

**Interfaces:**

- Consumes: `classifyMapLayer(layer)` and `applyMapPalette(map, theme)`.
- Produces: Regression coverage for road core/casing and negative transport cases.

- [x] **Step 1: Write failing palette and classifier tests**

Add literal expectations for `road: "#D5D8D2"` and `edge: "#BEC4BC"`. Add table cases for `road_motorway`, `road_trunk_primary`, `road_secondary_tertiary`, their `_casing` variants, generic `transportation_primary` road layers, and negative cases such as `railway_transit`, `aeroway_runway`, `ferry`, and `admin-boundary`.

- [x] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @iride/web test -- src/lib/map-palette.test.ts`

Expected: FAIL because the palette still uses `#FBFAF5`/`#C8D1C3` and transport casing classification is not yet explicit.

### Task 2: Implement the minimal classifier and palette fix

**Files:**

- Modify: `apps/web/src/lib/map-palette.ts`

**Interfaces:**

- Consumes: MapLibre layer `id` and `type` values returned by `map.getStyle()`.
- Produces: `classifyMapLayer()` returning `road` for road cores, `edge` for road casings/boundaries, and `null` for non-road transport lines.

- [x] **Step 1: Add narrowly scoped road matching**

Split road core/casing detection, match the named road hierarchy and road/transportation identifiers, reject rail/transit/aeroway/ferry/cable layers, and retain water and administrative boundary precedence.

- [x] **Step 2: Apply the approved colors**

Set `matchaLattePalette.road` to `#D5D8D2` and `.edge` to `#BEC4BC`. Do not change `water`, `contentKindColors`, raster paint values, or source selection.

- [x] **Step 3: Run focused tests and verify GREEN**

Run: `pnpm --filter @iride/web test -- src/lib/map-palette.test.ts src/lib/app-navigation-domain.test.ts`

Expected: PASS with road hierarchy, negative cases, and source-contract coverage.

### Task 3: Verify, review, and integrate

**Files:**

- Verify: `apps/web/src/lib/map-palette.ts`
- Verify: `apps/web/src/lib/map-palette.test.ts`

**Interfaces:**

- Consumes: completed code and production/local map pages.
- Produces: reviewed commit, pull request, green CI, and merged `main`.

- [x] **Step 1: Run repository verification**

Run: `pnpm --filter @iride/web lint`, `pnpm --filter @iride/web typecheck`, `pnpm --filter @iride/web test`, and `pnpm --filter @iride/web build`.

- [x] **Step 2: Inspect both themes in a real browser**

Open `/maps`, verify the map renders without an error overlay, switch between light and dark themes, and confirm controls/markers/water/boundaries retain their intended hierarchy. Record the raster fallback limitation separately from vector-layer correctness.

- [x] **Step 3: Request code review and address findings**

Review the commit range from `70943394` through HEAD against this plan; fix all Critical and Important findings and rerun verification.

- [ ] **Step 4: Commit and open the pull request**

Commit message: `fix(web): recolor all map road layers`

Push `codex/warm-gray-map-roads`, create a PR to `main`, wait for CI/review, address failures, and merge once required checks are green.
