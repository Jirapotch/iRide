# Design QA — selected main platform and mobile profile

## Homepage revision from browser comments — 2026-10-05

The user's four browser comments supersede the original five-station reference: remove the camera picker and scene-mode controls, remove the duplicate feature section outside the frame, and include Knowledge as a selectable 3D element. The frame now contains six stations in two rows; Knowledge is an open book with layered pages, a bookmark and desk lamp. All six destinations remain available inside the frame. Mobile uses a three-column/two-row button layout with 44px targets and horizontal orbit/native vertical scroll.

Current revision captures are `main-desktop-1440.png`, `main-1024.png`, `main-390.png`, and `main-360.png` under `.artifacts/profile-garage-design`. The earlier paired comparison below is historical evidence of the first approved direction, not the current six-station specification. The current screenshot was checked against the four annotated user screenshots; removed controls/section are absent and Knowledge is represented in the scene and controls. The Activities plaque was repositioned to avoid the motorcycle after the new two-row layout.

## Approved direction and comparison conditions

The user selected direction 1: `D:/Code/iRide/.artifacts/profile-garage-design/main-connected-platform.png`. Their subsequent correction removes mountains, forests and long hero text. The existing iRide navigation, logo, typography and theme remain authoritative. The implementation is interactive procedural Three.js geometry, as explicitly required, rather than the reference raster used as the scene.

Reference: 1487 × 1060. Render for comparison: 1440 × 1060, device pixel ratio 1, Thai light theme, Trips selected, Overview camera, reduced motion. Responsive renders also cover 1440 × 900, 1024 × 768, 390 × 844 and 360 × 800. A source and render were inspected together in the same comparison image, followed by a paired station crop.

- Full comparison: `.artifacts/profile-garage-design/main-comparison.png`
- Station comparison: `.artifacts/profile-garage-design/main-focus-comparison.png`
- Responsive renders: `main-desktop-1440.png`, `main-1024.png`, `main-390.png`, `main-360.png` in the same directory.
- Final production-build captures: `final-main-1440.png`, `final-main-390.png`, `final-main-360.png`; no development indicator, no runtime page errors and no horizontal overflow.
- Reproduction: `node .artifacts/profile-garage-design/capture-main.mjs http://127.0.0.1:3100/`

## Findings and repair history

| Priority | Finding                                                                                                     | Repair and result                                                                                                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2       | Platform initially too small relative to the selected target.                                               | Enlarged desktop stage and adjusted orthographic framing. Platform prominence now matches the target's hierarchy, with all five stations visible. Passed.                                                                   |
| P2       | Mobile framing left excessive whitespace and pushed the main controls down.                                 | Added a portrait camera composition, bounded mobile stage height and five compact feature buttons. Selection, zoom/reset and Open fit within the 360 × 800 initial view. Passed.                                            |
| P2       | Activities label intersected the bike.                                                                      | Adjusted the projected label anchor. Passed at desktop comparison sizes.                                                                                                                                                    |
| P2       | Manual orbit left the camera menu's selection stale.                                                        | Scene notifies React when orbit changes the camera to Overview. Browser regression passed.                                                                                                                                  |
| P2       | Document links lacked sufficient visual distinction in dark mode.                                           | Theme-aware foreground, underline, visible focus and 44px targets. Profile dark-mode browser checks passed.                                                                                                                 |
| P3       | Procedural meshes are simpler and less photographic than the generated target, particularly the motorcycle. | Retained native interactive geometry and recognizable tires, spokes, engine, luggage, mirrors, map pins and feature stations. This remains a visible fidelity difference; the result is not a pixel-identical reproduction. |

## Rendered and interaction review

The hierarchy is a single dark rounded platform with five raised white/mint stations, mint connections, short labels and compact controls. There is no scenic background or editorial hero copy. Existing iRide Geist/Noto Sans Thai fonts, header and navigation are preserved intentionally instead of copying the generated mock's invented header.

Mobile uses horizontal orbit with native vertical page scrolling, `touch-action: pan-y`, 44px or larger control targets, one selected scene label and five persistent feature buttons. Modes, keyboard focus, camera synchronization, dark theme, reduced motion, fallback navigation after WebGL failure and all five real destinations have browser coverage. Journey motion is explicitly marked as a demonstration.

Profile is assessed against the compact Ant Design brief rather than the rejected earlier scenic mockups: compact identity header, actual overview data, query-controlled tabs, garage cards, a detail drawer with history/documents alongside each other on desktop and a single mobile column. Forms retain values after failed saves. Browser checks cover light/dark, Back/Forward, record drafts, upload retry and primary/More actions.

## Result

Visual layout and responsive interaction: **passed**, with the disclosed P3 mesh-detail difference. No unresolved P0/P1/P2 visual findings. The reference comparison and mobile screenshots are retained locally. Optional export of implementation screenshots to Superdesign was rejected by automatic approval review; no export workaround was used.

This visual result does not certify production database deployment. Functional, database and build evidence is recorded separately in `docs/superpowers/plans/2026-10-04-profile-garage-ride-hub-ledger.md`.
