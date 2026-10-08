# UI-AUDIT-1 geometry audit — render-PLAY2-play2ui-geo-406f798-406f798

Commit 406f798b, 3 registry rows, 60 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 5 min.
Against the committed baseline: 0 failure key(s) counted (0 more under 0 exception(s)); baseline 0, new 0, fixed 0.
Measured 60, not opened 0, not reachable by design 0. Failures 0: outside 0, overflow 0, border 0, portrait 0, overlap 0, empty 0, controls 0, content 0, hud 0, ornament 0. Empty-space warnings 0.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| modal.history.family-links | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.65 | 0 |  |
| hud.event-card.famine-answered | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.61 | 0 |  |
| modal.history.year | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.64 | 0 |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (2)

- modal.history.family-links: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.year: the root has no data-frame (a container: its own border and the 8 px gap)
