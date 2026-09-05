# Matcha Map Motion Design

## Status

Approved by the user's instruction to implement the supplied Mint / Matcha Latte UI-UX brief directly in the existing iRide codebase.

## Product goal

Refine iRide into a calm, premium, minimal product without changing routes, API contracts, business logic, MapLibre sources, content layers, authentication, or data permissions. The map remains the primary working surface; motion clarifies hierarchy, feedback, and spatial continuity instead of decorating the interface.

## Visual system

- Primary Matcha: `#6F8F72`
- Deep Matcha: `#4F6F52`
- Soft Mint: `#BFD8C2`
- Pale Mint: `#E7F0E6`
- Matcha Latte: `#D9DFC7`
- Cream: `#F6F3E8`
- Warm White: `#FBFAF5`
- Warm Gray: `#8B8E84`
- Dark Text: `#27322A`
- Use editorial spacing, subtle borders and shadows, controlled radii, and clear typographic hierarchy.
- Remove residual blue/black visual styling and avoid neon, heavy glassmorphism, excessive gradients, nested cards, oversized pills, or decorative motion.

## Map experience

- Inspect each loaded MapLibre style at runtime and change only real layers returned by `map.getStyle()`.
- Vector basemap: cream ground, muted mint-blue water, sage parks, beige buildings, warm-white roads, muted matcha highway hierarchy, charcoal-green labels, cream halos, and reduced POI noise.
- Raster fallback: preserve the existing OSM source and apply restrained raster paint adjustments so it supports the same calm hierarchy.
- Controls use cream surfaces, deep-matcha icons, subtle borders, pale-mint hover, and soft shadows. Keep zoom, compass, fullscreen, and geolocation available without dominating the map.
- Markers use a deep-matcha-centered tonal system, a warm-white center, subtle hover, and a restrained selected halo. Existing feature-kind meaning remains available through label and icon/text, not color alone.
- The current application exposes individual DOM markers only; it has no cluster source or route line layer. Do not invent either. Apply the brief's cluster and route rules when those real layers are introduced in a future product slice.
- Desktop selection opens a side detail panel; mobile and tablet use a bottom sheet while retaining visible map context.
- Selecting a marker updates marker state, calls MapLibre `easeTo` with responsive camera padding, then reveals the corresponding detail content. MapLibre owns camera motion; GSAP only coordinates the surrounding DOM sequence.
- Filters expose their purpose, active result count, and state. Loading and recoverable errors remain visible but visually secondary.
- Selected map data always has a textual representation in the detail panel.

## Motion system

- Add GSAP only to the map route, where sequencing marker feedback, camera movement, and panel/content reveal provides real spatial continuity.
- Use a single restrained page/map entrance timeline: header/map workspace, primary controls, then secondary status.
- Keep ordinary hover, focus, active, disabled, field, filter, and navigation transitions in CSS.
- Motion tokens: fast `0.16s`, base `0.28s`, slow `0.45s`; small/medium/large offsets `8/16/24px`; standard `power2.out`, emphasized `power3.out`.
- Prefer transform and opacity. Create timelines once per relevant state and clean them up with `gsap.context()` / `revert()`.
- With `prefers-reduced-motion: reduce`, skip stagger and route-draw effects, use instant MapLibre camera updates, and retain at most a short opacity change. Motion must never carry meaning.

## Responsive and accessibility behavior

- Preserve keyboard navigation, semantic landmarks, focus-visible treatment, dialog focus trapping, Escape/backdrop close, and focus restoration.
- Controls keep at least a 44px target. Body copy remains at least 16px; routine labels remain at least 14px where the layout permits.
- Desktop map uses a side panel and camera right-padding. Mobile map uses a bottom sheet and camera bottom-padding. Tablet clears the fixed bottom navigation.
- The map cannot cause document growth or horizontal overflow at `360`, `390`, `768`, and `1280` widths.
- Validate with automated unit/E2E checks and browser screenshots in light, dark, desktop, and mobile states.

## Baseline audit

- Home has a coherent soft-mint direction but oversized uniform cards weaken hierarchy on narrow screens.
- The OSM raster fallback is highly saturated, especially roads and labels, so application markers and controls would compete with the basemap.
- Desktop map currently uses the whole canvas but the selected detail surface is still a bottom-pinned sheet, losing available horizontal space.
- Filter choices are understandable but detached from result count and loading feedback.
- Existing accessibility foundations are strong: skip link, semantic navigation, ARIA labels, focus trap, Escape/backdrop close, focus restoration, textual errors, and reduced-motion CSS.
- Screenshot evidence is stored locally under `D:/Code/iRide/.artifacts/ui-audit/`.

## Performance constraints

- Preserve route-level code splitting by importing GSAP only from the existing map Client Component.
- Do not animate MapLibre's canvas with DOM transforms.
- Do not write MapLibre paint properties every frame across many layers.
- Do not add ScrollTrigger, Flip, or other GSAP plugins because the current product flows do not justify them.
- Compare production build output before handoff and verify no new warnings.

## Delivery

- Add a GitHub pull-request CI workflow that runs install, format check, lint, typecheck, unit tests, and build on Node 24 with pnpm 11.19.0.
- Commit on `codex/matcha-map-motion`, push it, open a pull request to `main`, pass checks, and merge only after the final external-action confirmation required by the browser workflow.
