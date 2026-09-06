# Navigation UX, Loading States, and Breadcrumb Design

## Status

Approved in chat on 2026-09-06 after a repository audit and a live browser review of the public navigation flows.

## Product goal

Make every iRide interaction feel acknowledged, fast, predictable, and context-aware without changing business rules, API contracts, authorization decisions, or the visual identity. A navigation click must receive immediate tactile feedback; if destination data is slow, the destination structure must appear before that data resolves.

## Scope

This design covers the current Next.js App Router web application:

- primary and secondary links, cards, list rows, tabs, and menu destinations;
- route-level and section-level loading states;
- progressive rendering for independent server data;
- breadcrumbs and history-aware back navigation;
- preservation of search, filter, tab, pagination, modal, selection, and scroll context;
- navigation and mutation double-submit prevention;
- route and section error recovery;
- transition motion, keyboard focus, and assistive-technology status;
- focused unit and end-to-end regression coverage.

Login, onboarding, authorization, validation, and transaction confirmation may still block navigation when the destination cannot be decided safely. Those operations must expose a local pending state while they run.

## Non-goals

- Do not redesign page content, navigation information architecture, or the Matcha visual system.
- Do not replace App Router with a client-side router or migrate all server data to Redux.
- Do not add a global loading overlay or a new data-fetching library.
- Do not prefetch every API response or hide slow operations behind long animations.
- Do not change API payloads, database behavior, permissions, or content semantics.

## Audit findings

### Confirmed strengths

- Internal destinations already use `next/link`, so client navigation and framework prefetching are available.
- Primary navigation exposes `aria-current`, the application has a skip link and visible focus styles, and global CSS honors `prefers-reduced-motion`.
- The main create/profile forms already use a form-status button with disabled and busy feedback.
- Maps keeps its working layout visible when marker loading fails and reports that failure inline.

### Problems to correct

- No source-side `await fetch(); router.push()` pattern was found. The visible delay instead comes from dynamic destination routes awaiting server data before a useful fallback can render.
- Only the community segment has `loading.tsx`; its fallback is a generic card and text rather than a skeleton matching the destination layout.
- Community waits for posts, events, and viewer data together. Profile waits for profile, owner, garage, and activities together. Admin and create routes also serialize some independent reads.
- Community and profile convert API failures to empty arrays, causing failures to appear as legitimate empty states.
- No route defines `error.tsx`, and several section errors have no retry control.
- Nested Community, Profile, Maps, and Admin flows have no breadcrumb system.
- Admin detail hardcodes its return link to `/settings/users`, losing list query and pagination context.
- Search stores its query only in component state. The live audit confirmed that browser Back returns to `/search` with the query and result state cleared.
- Profile is outside the shared `(main)` route group and creates a second `AppShell`, increasing the work required when navigating between the main product and a profile.
- Active/pressed feedback is applied to buttons and a few action links, but not consistently to navigation links, category cards, result rows, room cards, and admin rows.
- There is no link-pending acknowledgement or route focus manager. The live audit observed focus returning to the document rather than the destination heading on nested community navigation.
- Admin mutation buttons do not use the shared pending button, leaving a repeat-submit window.

The live browser evidence covered Home, vehicle Community, Talk, Search, browser Back, and Maps at a mobile-sized viewport. Authenticated Profile and Admin flows were inspected from code because the local API/auth service was unavailable during the audit. This design does not claim complete WCAG conformance; keyboard, screen-reader, zoom, and contrast checks remain acceptance work.

## Architecture

### 1. Preserve the application shell

`AppShell`, the header, primary navigation, and mobile navigation remain mounted while main-product routes change. Move the existing `users/[username]` route under the `(main)` route group without changing its URL, and remove the profile page's duplicate shell.

Keep login and onboarding in the standalone shell. Reuse request-scoped session/profile reads where the layout and a page need the same identity data, but do not weaken server-side authentication or authorization checks. Loading UI does not bypass required access decisions.

### 2. Immediate interaction feedback

Introduce a small reusable navigation-link status primitive based on the installed Next.js version's `useLinkStatus` API. It renders a fixed-size, non-layout-shifting pending hint inside important dynamic links. The hint appears only when navigation remains pending beyond roughly 100 ms; fast prefetched navigations do not flash an unnecessary loader.

Apply consistent tactile CSS to navigation items, cards, list rows, tabs, and menu links:

- pressed feedback occurs in the click frame;
- transforms remain subtle, at most a small translation or scale;
- transition duration stays between 100 and 180 ms;
- the animation never delays route execution;
- pending links expose an acknowledged state and ignore repeated activation until the pending navigation settles;
- disabled or pending styling never removes the feedback that the click was received.

Mutation actions use the existing form-status pattern or an equivalent scoped pending control. Mutation controls are disabled only while their own action is pending and retain `aria-busy` plus a readable pending label.

### 3. Destination-first loading shells

Use route-specific `loading.tsx` files for dynamic destinations and layout-matched skeleton components shared by route fallbacks and section Suspense boundaries. The persistent app chrome, breadcrumb, page title, and known toolbar controls render immediately; only data-dependent content becomes a skeleton.

Planned route behavior:

| Route | Immediate structure | Deferred content |
| --- | --- | --- |
| `/community/[vehicle]` | Breadcrumb, vehicle heading, room layout | Any future room metadata |
| `/community/[vehicle]/talk`, `/community/groups` | Breadcrumb, heading, create affordance | Feed, marker options, viewer-dependent actions |
| `/maps` | Map workspace and controls | Selected marker record and viewport markers |
| `/search` | Heading and input | Result rows after a query |
| `/create` | Form type and form structure after required access decision | Marker/event options |
| `/users/[username]` | Profile-shaped route skeleton, then identity header | Garage and activities independently |
| `/settings/users` | Admin heading and search controls after authorization | User rows and pagination totals |
| `/settings/users/[id]` | Breadcrumb and detail-shaped skeleton after authorization | User record and content list |

Skeletons use the dimensions and hierarchy of real content, are hidden from assistive technology, and place `aria-busy` on the region being updated. A large centered spinner is not the default loading experience.

### 4. Progressive data boundaries

Split independent reads into focused async Server Components behind separate `<Suspense>` boundaries. Do not hold a whole page behind `Promise.all` unless all values are required to decide the same piece of UI.

- Community feed data streams independently from marker options and viewer-only actions.
- Profile identity resolves before the profile page is considered valid; garage and activities stream independently after that.
- Admin authorization remains a required gate, but list/detail content renders behind its own skeleton after access is confirmed.
- Create authorization remains a required gate, while optional marker choices load independently from the editable form.
- Map canvas and controls remain usable while marker or selected-record requests run.

Request deduplication or framework caching may be used for safe repeated reads, but user-specific or permission-sensitive data must retain its current freshness and access guarantees.

### 5. Error and empty-state semantics

An empty response and a failed response are different states. Remove broad `.catch(() => [])` handling where it converts an unavailable API into “no content.” Data sections return or throw enough information to render one of four explicit states: loading, content, empty, or error.

Add route-level `error.tsx` recovery where a whole destination cannot render, while keeping the shared application shell usable. Independent sections render their own compact error message and Retry control so one failed request does not discard successful sibling content. Maps retains its current non-blocking error behavior and gains an explicit retry path. Destination failures never navigate the user back automatically.

### 6. Breadcrumb model

Create a central breadcrumb resolver in the navigation domain. It owns route-pattern hierarchy and localized static labels. Pages provide only dynamic entity labels already known to that page, such as a username, vehicle category, or admin display name.

Each breadcrumb item contains a stable key, localized label, and optional href. Ancestors are links; the current page uses `aria-current="page"` and is not clickable. Desktop shows the full hierarchy. Mobile shows a compact immediate-parent control while keeping the complete hierarchy available to assistive technology.

Examples:

- Home / Cars / Talk
- Home / Search
- Home / Profile / Garage
- Home / Manage users / User name

### 7. History and state preservation

Use browser history for user-visible Back controls when the current screen was opened from an in-app parent, with a safe parent-route fallback for direct entry or a new tab. Do not hardcode detail Back controls to Home or to a context-free list URL.

State that defines a restorable view belongs in the URL:

- Search uses `?q=` and updates it without scrolling to the top.
- Admin retains `q` and `page`; returning from a user detail uses browser history so the exact list URL is restored.
- Profile retains its existing `tab`, `vehicle`, and `modal` parameters.
- Maps retains `marker`, `modal`, and active layer/filter state where it changes the visible result set.
- Community retains selected post and modal state.

Next.js/browser scroll restoration remains the default for back/forward navigation. Components must not remount the persistent shell or replace list URLs in a way that discards the history entry. End-to-end tests verify scroll restoration on a long list rather than adding a second custom scroll store unless native restoration proves insufficient.

Overlay close behavior uses history when the overlay was opened by a pushed in-app URL. Direct-entry overlays close to their canonical non-modal URL. Dirty edit confirmation behavior remains unchanged.

### 8. Prefetching and perceived performance

Keep `next/link` as the default for internal navigation. Route loading fallbacks make dynamic routes partially prefetchable; production behavior, not development-only timing, is the acceptance baseline. Explicit prefetching is reserved for high-confidence destinations that are not already covered by visible links. Do not prefetch broad API collections or mutation endpoints.

The primary fix is a useful prefetched route shell plus progressive streaming. Inline pending hints are a secondary acknowledgement for the remaining slow transitions, not a substitute for loading boundaries.

### 9. Route transition and focus

Apply a non-blocking entrance animation to newly mounted page content: opacity plus at most 4–8 px vertical movement over roughly 180–220 ms. Do not add an exit animation or full-screen transition that delays navigation. The existing reduced-motion rule disables the movement and shortens the fade to effectively instant.

Add a route focus manager at the persistent shell boundary. After a pathname change, focus moves to the destination's primary heading or the main content container with `tabIndex={-1}`. Query-only updates such as typing in Search do not steal focus. Existing focused controls, dialogs, focus traps, and explicit input autofocus remain intact where they better represent the user's task.

Use live regions only for asynchronous status that is not otherwise communicated, such as search result updates or section retry results. Avoid announcing every skeleton or decorative animation.

## Testing strategy

Implementation follows test-first development.

### Unit tests

- Breadcrumb route-pattern resolution, localization, dynamic labels, and ancestor hrefs.
- URL helpers for search, admin list state, map filters, modal canonical URLs, and safe return paths.
- History-aware back fallback decisions without depending on undocumented Next.js history fields.
- Error-versus-empty result mapping.

### End-to-end tests

- A pressed state is applied in the click frame and a pending hint appears for an intentionally delayed dynamic route.
- The destination loading shell appears before delayed API data resolves.
- Independent profile/community sections reveal separately when one response is slower.
- API failures render an error with Retry and never masquerade as an empty state.
- Search query, admin filters/pagination, profile tab, map filters, and selected modal context survive detail navigation and browser Back.
- Browser Back restores the previous list scroll position.
- Repeated navigation clicks and mutation submits cause one navigation or action.
- Keyboard focus reaches the destination heading after pathname navigation and remains in the Search input for query-only updates.
- Breadcrumb ancestors are keyboard accessible and expose the correct current page.
- Reduced-motion mode removes route movement while preserving state feedback.
- Mobile shows the compact parent breadcrumb; desktop shows the full hierarchy.

### Verification

Run focused tests during each slice, then the full lint, typecheck, unit-test, production-build, and Playwright suites. Verify dynamic-route navigation against a production server because Next.js does not prefetch routes in development. Capture representative mobile and desktop screenshots for loading, content, empty, and error states.

## Acceptance criteria

- Every in-scope interactive navigation surface acknowledges activation immediately.
- A dynamic destination shows its own structure without waiting for unrelated destination data.
- No destination page defaults to a blank screen or global blocking overlay while data loads.
- Independent data sections can reveal and recover independently.
- API errors remain distinguishable from legitimate empty data.
- Nested routes expose a responsive, accessible breadcrumb derived from the central hierarchy.
- Back returns to the real prior context when available and uses a safe canonical fallback on direct entry.
- Search, filters, pagination, selected tabs/modals, and scroll survive the tested list-to-detail-to-back journeys.
- Navigation and mutations cannot be triggered repeatedly while their own operation is pending.
- Required authorization and validation gates remain enforced and show scoped progress.
- Motion stays subtle, never delays navigation, and respects reduced-motion preferences.
- Existing business behavior, routes, API contracts, permissions, and Matcha styling remain intact.

## Delivery order

1. Navigation-domain primitives, breadcrumbs, tactile interaction states, and focus management.
2. Shared route/section skeletons and loading coverage.
3. Community and Profile progressive rendering plus correct error semantics.
4. Search, Maps, and Admin history/state preservation and retry behavior.
5. Mutation repeat-submit protection, route transition polish, and production-mode verification.

This order establishes shared behavior first, then migrates high-impact flows without requiring a risky all-at-once rewrite.
