# UI-AUDIT-1 geometry audit — astra-HERDS-geometry-final-a77c3df

Commit a77c3df5, 4 registry rows, 80 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 11 min.
Against the committed baseline: 0 failure key(s) counted (0 more under 0 exception(s)); baseline 0, new 0, fixed 0.
Measured 80, not opened 0, not reachable by design 0. Failures 0: outside 0, overflow 0, border 0, portrait 0, overlap 0, empty 0, controls 0, content 0, hud 0, ornament 0. Empty-space warnings 0.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.status-pill | css (tooltip) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.time-cluster | css (strip-top) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.action-dock | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.68 | 0 |  |
| map.selection.house | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.47 | 0 |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (1)

- hud.action-dock: the root has no data-frame (a container: its own border and the 8 px gap)
