# UI-AUDIT-1 geometry audit — render-NAT4-land-load-660a527

Commit 660a5270, 1 registry rows, 10 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 0 min.
Against the committed baseline: 0 failure key(s) counted (0 more under 1 exception(s)); baseline 0, new 0, fixed 0.
Measured 10, not opened 0, not reachable by design 0. Failures 0: outside 0, overflow 0, border 0, portrait 0, overlap 0, empty 0, controls 0, content 0, hud 0, ornament 0. Empty-space warnings 10.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| modal.chapter-loading | flat (none) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.01 | 0 |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (1)

- modal.chapter-loading: the root has no data-frame (a container: its own border and the 8 px gap)
