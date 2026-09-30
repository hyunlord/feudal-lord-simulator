# UI-AUDIT-1 geometry audit — render-UIAUDIT-fixa-v2-c54d7af

Commit c54d7afe, 12 registry rows, 132 row × condition cells (3 viewports × 2 copy × 2 numbers where they apply), 14 min.
Against the committed baseline: 0 failure key(s) counted (0 more under 1 exception(s)); baseline 0, new 0, fixed 0.
Measured 132, not opened 0, not reachable by design 0. Failures 0: outside 0, overflow 0, border 0, portrait 0, overlap 0, empty 0, controls 0. Empty-space warnings 6.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.layer-switch | flat (none) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.layer-switch-note | css (tooltip) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.50 | 0 |  |
| hud.action-dock | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.97 | 0 |  |
| hud.steward-bubble | css (advisor) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| hud.crisis-icons | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.98 | 0 |  |
| hud.stuck-goods | css (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| hud.event-chips | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.93 | 0 |  |
| hud.event-card | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.65 | 0 |  |
| hud.zone-toolbar | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.82 | 0 |  |
| hud.zone-land-legend | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.76 | 0 |  |
| modal.petition.heir | layer (petition) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.49 | 0 |  |
| modal.person-card | painting (person-card) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.43 | 0 |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (5)

- hud.layer-switch: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.action-dock: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.crisis-icons: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.stuck-goods: the root has no data-frame (measured by its border and border-image)
- hud.event-chips: the root has no data-frame (a container: its own border and the 8 px gap)
