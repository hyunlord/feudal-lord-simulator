# UI-AUDIT-1 geometry audit — render-UIAUDIT-final-bda65e3

Commit bda65e3d, 93 registry rows, 996 row × condition cells (3 viewports × 2 copy × 2 numbers where they apply), 36 min.
Against the committed baseline: 0 failure key(s) counted (12 more under 1 exception(s)); baseline 24, new 0, fixed 24.
Measured 996, not opened 0, not reachable by design 4. Failures 12: outside 0, overflow 12, border 0, portrait 0, overlap 0, empty 0, controls 0. Empty-space warnings 344.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.status-pill | css (tooltip) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.season-strip-panel | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| hud.time-cluster | css (strip-top) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.settings-popover | css (dark) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.38 | 0 |  |
| hud.layer-switch | flat (none) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.69 | 0 |  |
| hud.layer-switch-note | css (tooltip) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.50 | 0 |  |
| hud.action-dock | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.68 | 0 |  |
| hud.steward-bubble | css (advisor) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| hud.crisis-icons | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.70 | 0 |  |
| hud.stuck-goods | css (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| hud.event-chips | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.72 | 0 |  |
| hud.event-card | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.65 | 0 |  |
| hud.goal-chips | css (objective) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.71 | 0 |  |
| hud.goal-help | css | — | — |  |  |  |  |  |  |  | | | not reachable: the help seal shows only on a tutorial card whose step has an advisor line; the opening card, the one after it and the chapter goal cards (tutorial off) carry none, and later steps need buildings finished (UI-AUDIT-1 smoke runs) |
| hud.unlock-banner | css | — | — |  |  |  |  |  |  |  | | | not reachable: shows only when a tutorial step unlocks a tool; no scripted path completes one (survey §2: no browser script reaches it) |
| hud.pause-veil | painting (pause-badge) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.completion-toast | css (toast) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| hud.era-ceremony | flat | — | — |  |  |  |  |  |  |  | | | not reachable: shows only on the tick an era is entered; no cached state sits on that tick (survey §2: static contrast check only) |
| hud.cause-legend | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| hud.zone-toolbar | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.70 | 0 |  |
| hud.zone-land-legend | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.76 | 0 |  |
| hud.placement-confirm | flat (flat) | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.67 | 0 |  |
| hud.prediction-chip | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.56 | 0 |  |
| hud.hover-tooltip | flat (flat) | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.build-drawer | css (strip-bottom) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.52 | 0 |  |
| hud.build-pinned | css (tooltip) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| hud.build-details | css | — | — |  |  |  |  |  |  |  | | | not reachable: the HUD's build drawer is controlled, which hides the details' toggle (BuildMenu.tsx: `open !== undefined`); nothing opens it in play |
| hud.qa-overlay | css (tooltip) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| slot.goals | css (slot) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.goals.drawer | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.67 | 0 |  |
| slot.goals.status | css (toast) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.54 | 0 |  |
| slot.goals.settlement | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.47 | 0 |  |
| slot.goals.era-console | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.44 | 0 |  |
| slot.population | css (slot) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.population.panel | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.50 | 0 |  |
| slot.inspector | css (slot) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.inspector.body | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.39 | 0 |  |
| slot.ledger.stock | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.26 | 0 |  |
| slot.ledger.alerts | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.30 | 0 |  |
| slot.ledger.view | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.19 | 0 |  |
| slot.ledger.map | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.34 | 0 |  |
| slot.ledger.map-overview | css (dark) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.ledger.rights | css (rights) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.51 | 0 |  |
| slot.ledger.rights-decline | css (rights) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.46 | 0 |  |
| slot.ledger.wage | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.26 | 0 |  |
| slot.ledger.reorg | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.26 | 0 |  |
| slot.ledger.legacy | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.26 | 0 |  |
| map.selection.house | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.49 | 0 |  |
| map.selection.walker | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.29 | 0 |  |
| map.selection.site | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.30 | 0 |  |
| map.selection.farmstead | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.40 | 0 |  |
| map.selection.store | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.31 | 0 |  |
| modal.pause | css (modal) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.46 | 0 |  |
| modal.season-ledger | layer (season-ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.51 | 0 |  |
| modal.famine | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.56 | 0 |  |
| modal.petition.ch1 | layer (petition) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.70 | 0 |  |
| modal.petition.ch2-war | layer (petition) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.63 | 0 |  |
| modal.petition.ch4-reorg | layer (petition) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.60 | 0 |  |
| modal.petition.ch5-legacy | layer (petition) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.62 | 0 |  |
| modal.petition.heir | layer (petition) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.49 | 0 |  |
| modal.chapter-page.ch1 | layer (chapter-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| modal.chapter-page.ch2 | layer (chapter-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| modal.chapter-page.ch3 | layer (chapter-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| modal.chapter-page.ch4 | layer (chapter-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.34 | 0 |  |
| modal.chapter-page.ch5 | layer (chapter-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.39 | 0 |  |
| modal.chapter-preview | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.02 | 0 |  |
| modal.chapter-preview.goals | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.62 | 0 |  |
| modal.chapter-loading | flat (none) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.01 | 0 |  |
| modal.person-card | painting (person-card) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.43 | 0 |  |
| modal.history.records | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.68 | 0 |  |
| modal.history.record-card | layer (record-person) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.79 | 0 |  |
| modal.history.snapshot-map | layer (snapshot-320) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| modal.history.snapshot-figure | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| modal.select-list | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| modal.history.decision | layer (decision) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.18 | 0 |  |
| modal.history.biography | painting (biography) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.20 | 0 |  |
| modal.history.family-tree | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.15 | 0 |  |
| modal.history.tree-banner | css (tree-banner) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.19 | 0 |  |
| modal.history.tree-generation | css (tree-generation) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| modal.history.tree-node | css (tree-node) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.66 | 0 |  |
| modal.history.factions | flat (none) | 12 | 12 | 0 | 12 | 0 | 0 | 0 | 0 | 0 | 0.75 | 0 | overflow: a part scrolls (x) — `div.chronicle-factions > section.chronicle-world > ol.chronicle-world-strip` 1034px |
| modal.history.faction-page | painting (faction-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.34 | 0 |  |
| modal.legacy-ending | layer (chapter-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.36 | 0 |  |
| modal.chronicle-book | layer (chapter-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.35 | 0 |  |
| modal.chronicle-book.chapter | layer (chapter-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.20 | 0 |  |
| modal.chronicle-book.family | layer (chapter-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.21 | 0 |  |
| modal.chronicle-book.factions | layer (chapter-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.18 | 0 |  |
| modal.chronicle-book.legacy | layer (chapter-page) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.21 | 0 |  |
| screen.welcome | css (modal) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.52 | 0 |  |
| dev.ui-kit | css (light) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.38 | 0 |  |
| dev.ui-kit.section | css (light) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.12 | 0 |  |
| dev.ui-kit.dark | css (dark) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.10 | 0 |  |
| dev.ui-kit.tooltip | css (tooltip) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.69 | 0 |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (11)

- hud.layer-switch: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.action-dock: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.crisis-icons: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.stuck-goods: the root has no data-frame (measured by its border and border-image)
- hud.event-chips: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.chapter-preview: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.chapter-loading: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.records: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.snapshot-figure: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.family-tree: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.factions: the root has no data-frame (a container: its own border and the 8 px gap)
