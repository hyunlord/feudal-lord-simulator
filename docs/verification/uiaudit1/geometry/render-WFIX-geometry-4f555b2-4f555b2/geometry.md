# UI-AUDIT-1 geometry audit — render-WFIX-geometry-4f555b2-4f555b2

Commit 4f555b23, 3 registry rows, 30 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 2 min.
Against the committed baseline: 0 failure key(s) counted (0 more under 0 exception(s)); baseline 0, new 0, fixed 0.
Measured 30, not opened 0, not reachable by design 0. Failures 0: outside 0, overflow 0, border 0, portrait 0, overlap 0, empty 0, controls 0, content 0, hud 0, ornament 0. Empty-space warnings 0.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.status-pill.sandbox | css (tooltip) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| screen.welcome | css (modal) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.51 | 0 |  |
| screen.welcome.house | css (none) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.53 | 0 |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (1)

- screen.welcome.house: the root has no data-frame (measured by its border and border-image)
