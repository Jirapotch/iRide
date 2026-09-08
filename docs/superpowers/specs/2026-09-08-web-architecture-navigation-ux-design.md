# Web Architecture and Navigation UX Design

## Scope

Refactor `apps/web` without changing routes, permissions, validation, API contracts, or product rules. The API and shared packages remain in scope for analysis, but implementation crosses those boundaries only when a web-facing contract cannot otherwise be made coherent.

## Architecture

`src/app` remains the Next.js App Router composition layer. Reusable behavior moves into feature-owned modules under `src/features`; truly generic presentation stays shared. Route files own parameter parsing, authorization, redirects, and composition, while feature modules own interaction state and presentation. Existing Redux/Saga theme persistence remains unchanged.

The work is incremental. It does not perform a wholesale directory rewrite. Large files are split only when a touched responsibility can be named, independently tested, and consumed through a narrow interface.

## Navigation and loading

Navigation uses Next.js `Link`, framework prefetching, `useLinkStatus`, route `loading.tsx`, and focused Suspense boundaries. Source controls provide pressed/pending feedback immediately; destination routes show a content-shaped shell while asynchronous data resolves. Authentication and authorization remain server-verified. Neutral shell placeholders may stream while auth-dependent navigation controls resolve, but unauthorized controls never flash.

Path changes move semantic focus to the destination route heading. Query-only changes are handled by their own semantic owner: tabs focus or announce their panel, dialogs manage dialog focus, and filters or map-marker changes announce results without resetting route focus. Mouse and touch never rely on `blur()` hacks; visible focus remains tied to keyboard modality via `:focus-visible`.

Games keep their standalone visual layout. They receive equivalent pending, loading, focus, reduced-motion, and back-link behavior without being moved into the main application shell.

## Interaction states

Hover, pressed, keyboard focus, current route, selected item, and loading remain distinct. Home feature cards may expand for hover or keyboard focus, but pointer focus after a click must not leave a selected-looking card while navigation is pending. Repeated destructive mutations remain disabled while pending; navigation only suppresses a repeated activation of the same destination and never locks other destinations.

## Data and errors

Reads that can execute independently start in parallel or stream behind local Suspense boundaries. A typed, safe error result distinguishes unavailable, unauthorized, forbidden, not-found, validation, and unknown failures without exposing raw backend messages. Each data surface distinguishes loading, success, empty, and error, and offers retry when retry is meaningful.

## Styling

The existing visual direction is preserved. New visual changes are limited to loading, error, empty, pressed, pending, active-route, and focus-visible states. Styles for a feature touched by this work may move from the global stylesheet to a colocated CSS module; unrelated global styles stay in place.

## Performance and accessibility acceptance

- Press feedback is observable by the next animation frame.
- Pending feedback becomes visible within 100 ms when navigation has not committed.
- No nonessential API request is awaited before navigation starts.
- Persistent shell UI does not disappear during page data loading.
- Tab, Shift+Tab, Enter, Space, Escape, browser Back/Forward, direct URLs, refresh, and reduced motion remain usable.
- Active navigation derives from the URL and uses `aria-current` where appropriate.
- Loading announcements are localized and do not repeatedly interrupt assistive technology.

## Verification

Use focused Vitest tests for pure policies and component contracts, plus Playwright coverage for Chromium desktop, Pixel-class mobile Chromium, and mobile WebKit. Deterministic request interception covers slow, failed, and empty states. Every behavior change follows a red-green-refactor cycle. Final verification runs lint, typecheck, tests, production build, and the relevant E2E slice; database tests are required only if implementation crosses the database boundary.
