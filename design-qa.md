# Interactive Discovery Home — Design QA

- Source design truth: `C:\Users\gentk\Downloads\Prompt — Redesign Home Page + Interactive Feature Cards.md`, supported by the generated visual assets `apps/web/public/home/hero-journey.png` (1536 × 1024) and `apps/web/public/home/game-road.png` (1890 × 832).
- Rendered implementation: `.artifacts/home-discovery/home-discovery-desktop.png`, `.artifacts/home-discovery/home-discovery-mobile.png`, `.artifacts/home-discovery/home-feature-cards-desktop.png`, and `.artifacts/home-discovery/games-desktop-dark.png`.
- Viewports: 1280 × 900 desktop and 390 × 844 mobile; device scale factor 1.
- Captures: desktop Home 1280 × 3693, mobile Home 390 × 4363, focused feature cards 1178 × 440, Games 1280 × 900.
- Density normalization: none required; all captures use 1× CSS pixels. The source brief is written rather than a fixed-pixel page mock, so comparison is against its composition, hierarchy, interaction, and brand requirements rather than pixel-for-pixel geometry.
- State: signed-out English, light Home; signed-out English, dark Games; independent BFF error states visible on the full-page Home captures.

## Full-view comparison evidence

- The rendered hierarchy follows the approved flow: full-bleed hero, signature feature selection, conditional Continue area, editorial Trending, Activities, full-bleed Game Spotlight, horizontal Group Discovery, Explore CTA, and footer.
- Desktop preserves the intended 33/33/33 default composition and the implementation exposes 50/25/25 hover/focus expansion. Mobile converts the same features to tall vertical story cards with no horizontal page overflow.
- Mint–Matcha surfaces, dark forest imagery, large editorial type, whitespace, and alternating full-bleed/content-width sections avoid the dashboard/card-grid appearance called out in the brief.
- Light and dark states retain readable foreground/background contrast. Navigation remains fixed and legible over both themes.

## Focused region comparison evidence

`.artifacts/home-discovery/home-feature-cards-desktop.png` was captured separately because card details are too small in the full-page image. It confirms distinct visual treatments, stable equal tracks at rest, readable small copy, real iconography, constrained light/parallax layers, and visible destination affordances. The Games capture confirms the `/games` breadcrumb and Preview/Coming soon treatment without invented score data.

## Required fidelity surfaces

- Fonts and typography: the existing Geist family is retained; oversized condensed-feeling weight, tight display tracking, readable body line heights, and restrained all-caps kickers produce the requested editorial hierarchy in both languages.
- Spacing and layout rhythm: full-bleed image bands alternate with a 1180px content frame; section gaps, card padding, radii, and elevation are consistent without horizontal divider dependence.
- Colors and tokens: all UI surfaces use the existing Matcha/Mint theme tokens. Dark areas use the generated road imagery with controlled veils rather than neon or excessive glass effects.
- Image quality and asset fidelity: both source assets are generated raster images sized for their actual slots, rendered through `next/image`, and cropped responsively. No placeholder or handcrafted SVG imagery replaces visible assets.
- Copy and content: primary UX is localized Thai/English. Real posts/events drive their sections; browser-only demo groups are labeled, and the Games page clearly says Preview/Coming soon without fabricated gameplay or scores.

## Findings

- No actionable P0, P1, or P2 visual differences remain against the approved brief.
- P3: the Next.js development badge appears in local development captures; it is framework-only chrome and is absent from production builds.

## Comparison history

- Initial responsive capture showed the expected fixed bottom navigation duplicated mid-image by Playwright full-page screenshot stitching. Live in-app browser inspection confirmed the control stays pinned to the viewport; no product fix was required.
- Focused feature-card and Games captures found no P0/P1/P2 issue requiring another implementation iteration.

## Primary interactions checked

- Feature-card hover/focus state, Enter navigation, immediate pending-link feedback, local category filtering, browser-only Join state, responsive overflow, reduced motion, lazy map request, theme switching, breadcrumb navigation, and independent loading/error states.
- Browser console/runtime behavior was exercised by the E2E suite; no implementation error remained after the final lint/typecheck pass.

## Implementation checklist

- [x] Responsive Home and Games composition
- [x] Light/dark and Thai/English states
- [x] Keyboard/focus/reduced-motion behavior
- [x] Independent data states and lazy MapLibre request
- [x] Real data versus clearly labeled demo separation
- [x] Generated imagery integrated through `next/image`

final result: passed
