# UI-AUDIT-1 geometry audit — render-LMR3-geometry2-406deca

Commit 406deca3, 22 registry rows, 410 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 14 min.
Against the committed baseline: 0 failure key(s) counted (0 more under 0 exception(s)); baseline 0, new 0, fixed 0.
Measured 410, not opened 0, not reachable by design 0. Failures 0: outside 0, overflow 0, border 0, portrait 0, overlap 0, empty 0, controls 0, content 0, hud 0, ornament 0. Empty-space warnings 32.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.time-cluster | css (strip-top) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.event-chips | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.66 | 0 |  |
| hud.event-card | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.56 | 0 |  |
| hud.event-card.lord-moment | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.59 | 0 |  |
| hud.event-card.family-moment | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.60 | 0 |  |
| modal.history.family-links | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.65 | 0 |  |
| slot.goals.era-console | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.31 | 0 |  |
| slot.goals.era-console.lord | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.50 | 0 |  |
| modal.pause | css (modal) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.43 | 0 |  |
| hud.event-card.famine-answered | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.61 | 0 |  |
| modal.chapter-loading | flat (none) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.02 | 0 |  |
| modal.history.records | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.64 | 0 |  |
| modal.history.record-card | layer (record-person) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.67 | 0 |  |
| screen.welcome | css (modal) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.51 | 0 |  |
| screen.welcome.house | css (none) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.53 | 0 |  |
| lord.ledger.promises | css (slot) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.86 | 0 |  |
| lord.ledger.empty | css (slot) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.39 | 0 |  |
| lord.ledger.suit | css (slot) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.58 | 0 |  |
| lord.ledger.neighbour | css (slot) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.86 | 0 |  |
| hud.event-card.will-kept | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.63 | 0 |  |
| hud.event-card.trace | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.59 | 0 |  |
| modal.history.year | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.64 | 0 |  |

## Framed roots on screen that no registry row measures (2)

- `flat lord-ledger-book` (seen with lord.ledger.promises, lord.ledger.empty, lord.ledger.suit, lord.ledger.neighbour)
- `flat lord-ledger-track` (seen with lord.ledger.suit, lord.ledger.neighbour)

## Frame kind notes (6)

- hud.event-chips: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.family-links: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.chapter-loading: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.records: the root has no data-frame (a container: its own border and the 8 px gap)
- screen.welcome.house: the root has no data-frame (measured by its border and border-image)
- modal.history.year: the root has no data-frame (a container: its own border and the 8 px gap)
