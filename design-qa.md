# iRide Map-First Navigation Redesign — Design QA

## Evidence

- Original iRide visual source: `C:\Users\gentk\Downloads\ChatGPT Image 28 ส.ค. 2569 00_04_44.png`
- Map interaction reference: `https://getplayin.com/play/`
- Same-viewport source capture: `D:\Code\iRide\apps\web\qa-reference-playin-mobile.png`
- Final mobile capture: `D:\Code\iRide\apps\web\qa-final-mobile.png`
- Combined comparison input: `D:\Code\iRide\apps\web\qa-comparison-mobile.png`
- Final desktop capture: `D:\Code\iRide\apps\web\qa-final-desktop.png`
- Viewports inspected: 390 × 844 and 1280 × 720
- State: anonymous, English locale, default activity fixtures, List preference selected

## Visual comparison

The implementation borrows Playin's useful information architecture—map-first discovery, floating filters, Map/List switch, synchronized desktop list, and prominent center create action—while retaining iRide's near-black navy surfaces, electric-blue focus color, fine borders, dense premium cards, and compact typography.

At 390px, controls remain reachable above the safe-area navigation. The horizontal filter rail intentionally scrolls rather than shrinking labels. List cards use distinct activity-kind colors, stable image crops, and metadata that remains scannable. The mobile detail sheet sits above the bottom navigation and keeps its primary action visible. At 1280px, the map and list remain side-by-side while the same five destinations move into the header.

The in-app browser's captured frame did not composite MapLibre vector tiles, so the visual comparison uses the synchronized List state. DOM inspection verified that the live MapLibre canvas, OpenFreeMap attribution, navigation controls, and four accessible activity marker buttons are present. Map and List states, marker selection, filter selection, global grouped search, settings drawer, join persistence, and route navigation were exercised in the running app.

## Comparison history

- P1 — Accessible markers were not attached until the style load event. Fixed by attaching MapLibre markers immediately and re-synchronizing them after style readiness.
- P1 — Legacy navigation exposed Trips, Events, Garage, Photography, Explore, and Messages as first-class pages. Replaced with five destinations and removed routes now resolving through Next.js 404.
- P2 — Language and account actions appeared in the header. Moved both into the settings drawer only.
- P2 — Vehicle content remained motorcycle-heavy. Added matching premium car and bicycle imagery and balanced Market/Profile content across all three vehicle kinds.
- P2 — Root list and detail sheet could compete for the same mobile space. Constrained the sheet above the safe-area navigation and preserved a visible close/join action.

## Final findings

- No P0, P1, or P2 visual discrepancies remain.
- Mobile hierarchy, safe-area spacing, 44px controls, contrast, focus rings, image crops, and navigation reachability are consistent with the approved direction.
- Production routes contain only the approved page set; the removed activity/chat routes are absent from the build manifest.
- Unit, type, lint, production build, and in-app browser checks pass. Lint reports only the intentional Next.js recommendation to migrate fixture images to `next/image`.

final result: passed
