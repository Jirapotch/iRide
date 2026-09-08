# UI migration notes

These notes capture the behavior and boundaries reviewed before the current modernization slice. The production application remains the functional reference, while the modernization document supplies the visual direction.

## Application shell and navigation

- Current behavior: desktop top navigation and a five-item mobile bottom navigation preserve the existing route names, active state, theme control, locale control, and authentication entry points.
- Data flow: route state comes from the URL; locale stays in the HttpOnly locale cookie; the Redux preferences slice owns mutable client theme state and its saga persists the choice.
- Invariants: routes and accessible navigation names do not change, and theme/locale remain available at mobile and desktop widths.
- UI weaknesses addressed: inconsistent control sizing, narrow-screen spacing, and scattered theme values.
- Changed files: root layout, theme provider, global styles, navigation, preferences feature, store, and centralized Ant Design tokens.
- Intentionally untouched: route composition, authentication redirects, content DTOs, and server-side navigation data.

## Settings drawer and administrator directory

- Current behavior: settings opens as a focus-managed drawer; administrators can scan users and open the existing detail route.
- Data flow: the page remains a Server Component that loads the directory; the client feature receives serializable rows and renders them without fetching credentials in the browser.
- Invariants: permission checks, user detail URLs, bilingual labels, and empty/error states remain unchanged.
- UI weaknesses addressed: mobile table overflow and inconsistent settings surfaces. Desktop keeps an Ant Design table; mobile uses a stacked presentation of the same records.
- Changed files: settings user page, admin directory feature, navigation, and shared tokens.
- Intentionally untouched: moderation actions, server API adapter, role/status transitions, and audit behavior.

## Public profile

- Current behavior: the public profile keeps media, garage, activity, and owner actions while using the responsive application shell.
- Data flow: read data stays server-loaded; owner mutations and uploads retain their current protected server paths. The Nest profiles module now performs profile reads and owner updates through actor-aware TypeORM transactions.
- Invariants: public DTOs omit coordinates and authentication metadata; private/suspended profiles remain hidden; profile URLs and media permissions do not change.
- UI weaknesses addressed: custom button styling is replaced with direct Ant Design components and shared tokens.
- Changed files: public profile screen, profile Nest module/repository, database runtime service, and application module.
- Intentionally untouched: garage/content repositories, media object contracts, Supabase Auth, and the public API response shape.

## Matcha map and motion refresh

- Current behavior: Explore keeps the existing activity payloads, filters, marker selection, and details while presenting a calmer MapLibre surface in a unified Mint–Matcha Latte theme.
- Data flow: the existing server request and marker data remain authoritative. A pure camera-policy helper derives selection padding and duration from the viewport, while GSAP only orchestrates rendered UI transitions.
- Invariants: activity routes, API contracts, marker categories, search/filter semantics, authentication, and map tile providers do not change.
- UI weaknesses addressed: saturated raster tiles are softened through MapLibre paint properties; map results are announced visibly and accessibly; selected markers, controls, filters, and details share one visual language; desktop details use a tall side panel; mobile Home choices are denser and keyboard focus is explicit.
- Motion and accessibility: durations use centralized 160/280/450 ms tokens, transforms stay on compositor-friendly properties, focus is preserved during animation, and `prefers-reduced-motion` makes marker camera and panel transitions immediate.
- Changed files: shared theme tokens, map palette/style builder, map camera policy, Activity Hub, global styles, focused unit/E2E coverage, and the pull-request quality workflow.
- Intentionally untouched: clustering and route-line rendering because the current product has neither capability, plus server data, database schema, permissions, and navigation structure.

---

# Web architecture, navigation UX, loading, and focus migration

Date: 2026-09-08

## Scope and compatibility

This migration refactors `apps/web` while preserving routes, authorization, validation, API contracts, data models, and product rules. Games remain in their standalone route group and visual shell. The existing Redux Toolkit/Redux Saga preference flow remains unchanged.

There are no intentional breaking changes.

## Problems in the previous structure

- The App Router private `_components` folder mixed global navigation, home, community, content creation, activity-map, loading, error, and mock-notification responsibilities.
- `app-navigation.tsx` combined desktop navigation, bottom navigation, settings, theme/language controls, notifications, and route-active logic.
- Large feature components combined screen composition with comments, owner actions, forms, map dialogs, media, or profile panels.
- Some routes had no route-level loading UI, especially Maps and Games.
- The main shell waited for session/profile reads before it could render any visible structure.
- Route focus only reacted to pathname changes, so semantic query transitions such as profile tabs, admin filters, and create type changes were not handled.
- Home feature cards treated every DOM focus as a selected/expanded state, including pointer focus left behind during a slow navigation.
- Data read failures collapsed to one untyped error result.
- Playwright only described one browser project and the navigation UX regression suite was missing.

The scan did not find a click handler that awaited a nonessential API request before calling `router.push`. The navigation delay was therefore addressed at the feedback, streaming, and destination-loading layers instead of changing business flows.

## New responsibility boundaries

`src/app` is now the route-composition layer: route parameters, server authorization, redirects, data orchestration, layouts, and Suspense boundaries stay there. Reusable behavior and feature presentation live under `src/features`.

```text
apps/web/src/
├── app/
│   ├── (main)/
│   │   ├── _components/app-shell.tsx
│   │   ├── community/
│   │   ├── create/
│   │   ├── maps/
│   │   ├── settings/users/
│   │   └── users/[username]/
│   └── (games)/games/
├── features/
│   ├── activities/
│   │   ├── activity-kind-label.ts
│   │   └── components/
│   ├── community/components/
│   ├── content/components/
│   ├── errors/components/
│   ├── home/components/
│   ├── loading/components/
│   ├── navigation/components/
│   ├── notifications/components/
│   ├── profile/components/
│   └── search/components/
└── lib/
    ├── data-result.ts
    └── existing domain/API modules
```

### Moved and split components

- Navigation: `PendingLink`, `RouteFocusManager`, `RouteTransition`, `Breadcrumbs`, `HistoryBackButton`, desktop/header actions, bottom navigation, and route-derived navigation links.
- Home: feature selection, discovery, mini-map, and the colocated Home CSS module.
- Community: feed/data sections, screen composition, comment thread, and owner action menu.
- Content: create screen composition, content editor form, submit button, edit modal, and marker-options context.
- Activities: map hub, activity detail sheet, and shared activity-kind labels.
- Profile: profile screen, activity/garage panels, vehicle form, and media uploader.
- Notifications: provider, full screen, and accessible popover.
- Shared UX: content-shaped loading skeletons and typed section error UI.

Feature files use the existing `@/` alias; route-private deep relative imports were removed from the touched flows.

## Navigation and immediate feedback

- Internal navigation uses Next.js `Link` through `PendingLink`.
- A valid same-tab activation sets `aria-busy` immediately and exposes a local pending indicator while Next.js commits the route.
- Only a duplicate activation of the same pending destination is suppressed. Other navigation remains available.
- Pending acknowledgement self-recovers if Next.js never reports a pending transition.
- Main navigation active state is derived from the current pathname and exposes `aria-current="page"`.
- Games links use the same pending contract while preserving the standalone Games shell.
- High-probability framework prefetch remains enabled; the heavy game destination keeps explicit opt-out where already appropriate.
- Breadcrumbs use explicit hierarchy URLs. Browser history is only used by the admin detail helper when a known list origin exists, with a deterministic fallback URL.

## Loading and streaming

- The authenticated main shell is resolved behind a Suspense boundary with a neutral shell-shaped fallback, preventing a blank initial surface while session/profile reads resolve.
- Route-level loading UI now covers Community, Create, Maps, profile, admin list/detail, Games catalog, and the game route.
- Skeletons match their content type: cards, profile cover/detail, admin rows/detail, form, map canvas/panel, game catalog, and game stage.
- Loading labels are localized in Thai and English and expose `aria-busy`/accessible labels.
- Existing independent reads use `Promise.all`; nested route content keeps focused Suspense fallbacks so persistent shell navigation remains mounted.

## Focus, selection, and accessibility

- Generic mouse/touch focus does not draw the application focus ring; keyboard modality retains a clear `:focus-visible` outline.
- Home cards expand on hover or keyboard-visible focus. Pointer focus no longer leaves a selected-looking card while navigation waits.
- Pressed, current-route, pending, selected, hover, and keyboard-focus states are separate.
- Route pathname changes move semantic focus to the destination heading.
- Query-only changes use route-specific focus targets for profile panels, admin results, and create forms. Map marker/modal query changes intentionally keep dialog/map focus ownership.
- The notification popover declares dialog semantics, moves focus inside when opened, closes on Escape/outside pointer, and restores trigger focus after Escape.
- Mobile tap highlight is replaced by short custom pressed feedback; reduced-motion rules collapse nonessential animation.
- Mutation submit controls remain disabled while pending to prevent duplicate writes without locking navigation.

## Data, error, and empty states

`captureData` now returns a safe typed category: `unavailable`, `unauthorized`, `forbidden`, `not-found`, `validation`, or `unknown`. Raw backend error messages are never exposed by the classifier. Updated consumers pass the category into reusable error UI with a scoped retry action. Existing successful-but-empty feature messages remain distinct from failures.

## Performance impact

- Session and locale reads begin in parallel.
- Independent page reads continue to use parallel fetches where possible.
- The shell streams separately from auth/profile data.
- Route files remain Server Components; client boundaries are limited to interactive feature components.
- The Home animation dependency remains dynamically imported and is skipped for reduced-motion users.
- Feature ownership reduces accidental cross-feature client imports and makes later code splitting safer.

## Verification

- ESLint: passed with no output.
- TypeScript: passed with `tsc --noEmit`.
- Vitest: 10 files, 42 tests passed.
- Next.js production build: passed; all 21 application/API routes were generated as dynamic routes where expected.
- Playwright navigation UX matrix: 12 tests passed across desktop Chromium, Pixel-class mobile Chromium, and iPhone-class mobile WebKit.
- The E2E suite verifies immediate pending feedback under a held RSC request, pointer focus cleanup, keyboard-visible focus, persistent main navigation on a deep link, and Games pending affordance.
- `git diff --check`: passed.

## Remaining technical debt

- `activity-hub.tsx` still owns dense MapLibre viewport, marker, filter, and selection orchestration. The dialog/detail responsibility is now separated, but a later map-specific hook/service extraction would further reduce its size.
- `content-editor-form.tsx` is now isolated from screen composition, but its marker mention and coordinate-import/map picker can be split further once those flows have dedicated component tests.
- `globals.css` still contains substantial legacy feature styling. This migration colocates Home, loading, and error styles; further moves should remain incremental and be verified by computed-style or visual tests.
- Full authenticated create/edit/delete and database-backed community hierarchy flows still need seeded end-to-end fixtures. This migration did not change the database boundary, so database tests were not required for its implementation.
