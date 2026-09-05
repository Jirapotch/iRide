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
