# UI-AUDIT-1 geometry audit — render-SLICEOLD-geometry-d429d73-d429d73

Commit d429d73c, 2 registry rows, 40 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 3 min.
Against the committed baseline: 0 failure key(s) counted (0 more under 0 exception(s)); baseline 0, new 0, fixed 0.
Measured 40, not opened 0, not reachable by design 0. Failures 0: outside 0, overflow 0, border 0, portrait 0, overlap 0, empty 0, controls 0, content 0, hud 0, ornament 0. Empty-space warnings 14.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| modal.slice-end | layer (chapter-page) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.24 | 0 |  |
| modal.slice-end.record | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.64 | 0 |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (1)

- modal.slice-end.record: the root has no data-frame (a container: its own border and the 8 px gap)
