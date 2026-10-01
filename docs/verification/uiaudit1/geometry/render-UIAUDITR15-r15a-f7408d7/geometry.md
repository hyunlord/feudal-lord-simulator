# UI-AUDIT-1 geometry audit — render-UIAUDITR15-r15a-f7408d7

Commit f7408d71 (dirty tree), 58 registry rows, 1130 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 58 min.
Against the committed baseline: 215 failure key(s) counted (20 more under 1 exception(s)); baseline 0, new 215, fixed 0.
Measured 1129, not opened 1, not reachable by design 0. Failures 275: outside 2, overflow 32, border 0, portrait 0, overlap 0, empty 0, controls 0, content 227, hud 3, ornament 11. Empty-space warnings 379.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.crisis-icons | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.70 | 0 |  |
| hud.event-chips | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.72 | 0 |  |
| hud.build-drawer | css (strip-bottom) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.52 | 0 |  |
| slot.goals | css (slot) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.goals.drawer | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.67 | 0 |  |
| slot.goals.status | css (toast) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.54 | 0 |  |
| slot.goals.settlement | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.54 | 0 |  |
| slot.goals.era-console | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.30 | 0 |  |
| slot.population | css (slot) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.population.panel | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.inspector | css (slot) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.inspector.body | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.39 | 0 |  |
| slot.ledger.stock | css (ledger) | 20 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0.26 | 0 | hud: the surface covers a live HUD control — `steward-line` 8.5px |
| slot.ledger.alerts | css (ledger) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.30 | 0 |  |
| slot.ledger.view | css (ledger) | 20 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 0.19 | 0 | content: text not painted (covered by another layer) — `section.ledger-drawer.slot-panel > section.economy-overlays > span.overlay-heading` 0px |
| slot.ledger.map | css (ledger) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.34 | 0 |  |
| slot.ledger.map-overview | css (dark) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.ledger.rights | css (rights) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.61 | 0 |  |
| slot.ledger.rights-decline | css (rights) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.42 | 0 |  |
| slot.ledger.wage | css (ledger) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.26 | 0 |  |
| slot.ledger.reorg | css (ledger) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.26 | 0 |  |
| slot.ledger.legacy | css (ledger) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.26 | 0 |  |
| map.selection.store | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.31 | 0 |  |
| modal.season-ledger | layer (season-ledger) | 20 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 200 | 0 | 10 | 0.51 | 0 | content: required h2 not painted (covered by another layer) — `h2` 0px |
| modal.petition.ch1 | layer (petition) | 20 | 4 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.70 | 0 | overflow: a part scrolls (y) — `section.story-modal.petition-card > div.petition-body` 27px |
| modal.petition.ch2-war | layer (petition) | 20 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.63 | 0 | overflow: a part scrolls (y) — `section.story-modal.petition-card > div.petition-body` 46px |
| modal.petition.ch4-reorg | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.60 | 0 |  |
| modal.petition.ch5-legacy | layer (petition) | 20 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.62 | 0 | overflow: a part scrolls (y) — `section.story-modal.petition-card > div.petition-body` 8px |
| modal.petition.heir | layer (petition) | 20 | 4 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.49 | 0 | overflow: a part scrolls (y) — `section.story-modal.petition-card > div.petition-body` 5px |
| modal.petition.ch3-plague | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.57 | 0 |  |
| modal.petition.ch4-guild | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.65 | 0 |  |
| modal.petition.ch5-royal-tax | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.54 | 0 |  |
| modal.petition.ch5-legacy-choice | layer (petition) | 20 | 2 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.63 | 0 | overflow: a part scrolls (y) — `section.story-modal.petition-card > div.petition-body` 2px |
| modal.petition.interlude-guild | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.50 | 0 |  |
| modal.petition.interlude-church | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.50 | 0 |  |
| modal.chapter-page.ch1 | layer (chapter-page) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| modal.chapter-page.ch2 | layer (chapter-page) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| modal.chapter-page.ch3 | layer (chapter-page) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| modal.chapter-page.ch4 | layer (chapter-page) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.34 | 0 |  |
| modal.chapter-page.ch5 | layer (chapter-page) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.39 | 0 |  |
| modal.chapter-loading | flat (none) | 9 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 1 | 0.01 | 1 (.chapter-loading not on screen after the steps) | content: text not painted (covered by another layer) — `div.chapter-loading > p.chapter-loading-line` 0px |
| modal.history.records | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.64 | 0 |  |
| modal.history.record-card | layer (record-person) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.67 | 0 |  |
| modal.history.snapshot-map | layer (snapshot-320) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| modal.history.snapshot-figure | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| modal.history.decision | layer (decision) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.18 | 0 |  |
| modal.history.biography | painting (biography) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.20 | 0 |  |
| modal.history.biography.king | painting (biography) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.13 | 0 |  |
| modal.history.family-tree | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.15 | 0 |  |
| modal.history.tree-banner | css (tree-banner) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.19 | 0 |  |
| modal.history.tree-generation | css (tree-generation) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| modal.history.tree-node | css (tree-node) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.66 | 0 |  |
| modal.history.factions | flat (none) | 20 | 20 | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.75 | 0 | overflow: a part scrolls (x) — `div.chronicle-factions > section.chronicle-world > ol.chronicle-world-strip` 1034px |
| modal.history.faction-page | painting (faction-page) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.33 | 0 |  |
| modal.legacy-ending | layer (chapter-page) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.36 | 0 |  |
| modal.chronicle-book | layer (chapter-page) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| screen.welcome | css (modal) | 10 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.51 | 0 | outside: text beyond the inner box — `section.welcome-parchment > h2` 0.7px |
| dev.ui-kit | css (light) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.38 | 0 |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (7)

- hud.crisis-icons: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.event-chips: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.chapter-loading: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.records: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.snapshot-figure: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.family-tree: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.factions: the root has no data-frame (a container: its own border and the 8 px gap)
