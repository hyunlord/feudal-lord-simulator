# UI-AUDIT-1 geometry audit — render-CARDOPEN-geoA-c85522c-c85522c

Commit c85522c8, 11 registry rows, 220 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 29 min.
Against the committed baseline: 0 failure key(s) counted (0 more under 0 exception(s)); baseline 0, new 0, fixed 0.
Measured 220, not opened 0, not reachable by design 0. Failures 0: outside 0, overflow 0, border 0, portrait 0, overlap 0, empty 0, controls 0, content 0, hud 0, ornament 0. Empty-space warnings 0.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.event-chips | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.72 | 0 |  |
| hud.event-card | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.59 | 0 |  |
| hud.event-card.lord-moment | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.59 | 0 |  |
| hud.event-card.family-moment | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.58 | 0 |  |
| hud.event-card.famine-answered | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.61 | 0 |  |
| hud.event-card.will-kept | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.63 | 0 |  |
| hud.event-card.suit-defence | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.49 | 0 |  |
| hud.event-card.entry-threat | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.54 | 0 |  |
| hud.event-card.audit-kept | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.52 | 0 |  |
| hud.event-card.offmap-kept | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.49 | 0 |  |
| hud.event-card.home-petition-variant | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.60 | 0 |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (1)

- hud.event-chips: the root has no data-frame (a container: its own border and the 8 px gap)
