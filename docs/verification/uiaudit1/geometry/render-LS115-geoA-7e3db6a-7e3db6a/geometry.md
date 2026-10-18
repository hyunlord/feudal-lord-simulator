# UI-AUDIT-1 geometry audit — render-LS115-geoA-7e3db6a-7e3db6a

Commit 7e3db6ae, 32 registry rows, 482 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 26 min.
Against the committed baseline: 0 failure key(s) counted (0 more under 0 exception(s)); baseline 0, new 0, fixed 0.
Measured 482, not opened 0, not reachable by design 4. Failures 0: outside 0, overflow 0, border 0, portrait 0, overlap 0, empty 0, controls 0, content 0, hud 0, ornament 0. Empty-space warnings 48.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.status-pill | css (tooltip) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.92 | 0 |  |
| hud.status-pill.sandbox | css (tooltip) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.91 | 0 |  |
| hud.season-strip-panel | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| hud.time-cluster | css (strip-top) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.settings-popover | css (dark) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.39 | 0 |  |
| hud.layer-switch | flat (none) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.62 | 0 |  |
| hud.layer-switch-note | css (tooltip) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.51 | 0 |  |
| hud.action-dock | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.68 | 0 |  |
| hud.steward-bubble | css (advisor) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| hud.crisis-icons | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.54 | 0 |  |
| hud.stuck-goods | css (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| hud.event-chips | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.72 | 0 |  |
| hud.event-card | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.59 | 0 |  |
| hud.event-card.lord-moment | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.59 | 0 |  |
| hud.event-card.family-moment | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.58 | 0 |  |
| hud.goal-chips | css (objective) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.71 | 0 |  |
| hud.goal-help | css | — | — |  |  |  |  |  |  |  |  |  |  | | | not reachable: the help seal shows only on a tutorial card whose step has an advisor line; the opening card, the one after it and the chapter goal cards (tutorial off) carry none, and later steps need buildings finished (UI-AUDIT-1 smoke runs) |
| hud.unlock-banner | css | — | — |  |  |  |  |  |  |  |  |  |  | | | not reachable: shows only when a tutorial step unlocks a tool; no scripted path completes one (survey §2: no browser script reaches it) |
| hud.pause-veil | painting (pause-badge) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.completion-toast | css (toast) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| hud.era-ceremony | flat | — | — |  |  |  |  |  |  |  |  |  |  | | | not reachable: shows only on the tick an era is entered; no cached state sits on that tick (survey §2: static contrast check only) |
| hud.cause-legend | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.31 | 0 |  |
| hud.zone-toolbar | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.68 | 0 |  |
| hud.zone-land-legend | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.52 | 0 |  |
| hud.placement-confirm | flat (flat) | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.66 | 0 |  |
| hud.prediction-chip | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.56 | 0 |  |
| hud.hover-tooltip | flat (flat) | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.build-drawer | css (strip-bottom) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.46 | 0 |  |
| hud.build-drawer.fen | css (strip-bottom) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.67 | 0 |  |
| hud.prediction-chip.drain | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.37 | 0 |  |
| hud.build-pinned | css (tooltip) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| hud.build-details | css | — | — |  |  |  |  |  |  |  |  |  |  | | | not reachable: the HUD's build drawer is controlled, which hides the details' toggle (BuildMenu.tsx: `open !== undefined`); nothing opens it in play |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (5)

- hud.layer-switch: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.action-dock: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.crisis-icons: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.stuck-goods: the root has no data-frame (measured by its border and border-image)
- hud.event-chips: the root has no data-frame (a container: its own border and the 8 px gap)
