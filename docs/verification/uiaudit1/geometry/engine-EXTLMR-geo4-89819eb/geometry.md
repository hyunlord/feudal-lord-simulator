# UI-AUDIT-1 geometry audit — engine-EXTLMR-geo4-89819eb

Commit 89819eb8, 10 registry rows, 200 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 13 min.
Against the committed baseline: 0 failure key(s) counted (0 more under 0 exception(s)); baseline 0, new 0, fixed 0.
Measured 200, not opened 0, not reachable by design 0. Failures 0: outside 0, overflow 0, border 0, portrait 0, overlap 0, empty 0, controls 0, content 0, hud 0, ornament 0. Empty-space warnings 0.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.status-pill | css (tooltip) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.time-cluster | css (strip-top) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.action-dock | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.68 | 0 |  |
| hud.event-card | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.59 | 0 |  |
| map.selection.house | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.47 | 0 |  |
| modal.history.records | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.64 | 0 |  |
| modal.history.record-card | layer (record-person) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.67 | 0 |  |
| modal.history.factions | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.75 | 0 |  |
| modal.lord.registry | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.58 | 0 |  |
| modal.lord.registry-hold | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.67 | 0 |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (3)

- hud.action-dock: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.records: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.factions: the root has no data-frame (a container: its own border and the 8 px gap)
