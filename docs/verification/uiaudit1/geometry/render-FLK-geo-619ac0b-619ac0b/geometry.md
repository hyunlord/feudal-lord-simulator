# UI-AUDIT-1 geometry audit — render-FLK-geo-619ac0b-619ac0b

Commit 619ac0b6, 8 registry rows, 110 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 14 min.
Against the committed baseline: 0 failure key(s) counted (0 more under 0 exception(s)); baseline 0, new 0, fixed 0.
Measured 110, not opened 0, not reachable by design 2. Failures 0: outside 0, overflow 0, border 0, portrait 0, overlap 0, empty 0, controls 0, content 0, hud 0, ornament 0. Empty-space warnings 0.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.event-chips | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.72 | 0 |  |
| hud.event-card.lord-moment | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.59 | 0 |  |
| hud.goal-chips | css (objective) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.71 | 0 |  |
| hud.unlock-banner | css | — | — |  |  |  |  |  |  |  |  |  |  | | | not reachable: shows only when a tutorial step unlocks a tool; no scripted path completes one (survey §2: no browser script reaches it) |
| hud.completion-toast | css (toast) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| hud.era-ceremony | flat | — | — |  |  |  |  |  |  |  |  |  |  | | | not reachable: shows only on the tick an era is entered; no cached state sits on that tick (survey §2: static contrast check only) |
| hud.event-chips.market | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.64 | 0 |  |
| hud.event-card.trace | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.60 | 0 |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (2)

- hud.event-chips: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.event-chips.market: the root has no data-frame (a container: its own border and the 8 px gap)
