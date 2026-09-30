# UI-AUDIT-1 geometry audit — render-UIAUDIT-tool-real-b22a3a9

Commit b22a3a9e, 88 registry rows, 936 row × condition cells (3 viewports × 2 copy × 2 numbers where they apply), 25 min.
Measured 924, not opened 12, not reachable by design 4. Failures 2050: outside 832, overflow 737, border 60, portrait 12, overlap 409, empty 0, controls 0. Empty-space warnings 293.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.status-pill | css (tooltip) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.season-strip-panel | css (light) | 12 | 12 | 24 | 0 | 0 | 0 | 0 | 0 | 0 | 0.27 | 0 | outside: image beyond the inner box — `section.season-strip-panel > div.season-strip-full > span.season-strip-mark` 6.3px |
| hud.time-cluster | css (strip-top) | 12 | 12 | 24 | 12 | 12 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: control beyond the inner box — `div.hud-time-cluster > div.speed-control-stack > div.speed-seals > button.speed-seal` 2px |
| hud.settings-popover | css (dark) | 12 | 4 | 4 | 4 | 0 | 0 | 8 | 0 | 0 | 0.37 | 0 | outside: rule beyond the inner box — `div.command-popover.autoplay-control > div.save-controls` 8px |
| hud.layer-switch | flat (none) | 6 | 6 | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: control beyond the inner box — `div.layer-switch > button.control-layer` 8px |
| hud.layer-switch-note | css (tooltip) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.50 | 0 |  |
| hud.action-dock | flat (none) | 12 | 12 | 48 | 0 | 0 | 0 | 0 | 0 | 0 | 0.97 | 0 | outside: control beyond the inner box — `nav.action-dock > button.action-dock-button` 8px |
| hud.steward-bubble | css (advisor) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| hud.crisis-icons | flat (none) | 12 | 12 | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0.98 | 0 | outside: control beyond the inner box — `section.crisis-icons > button.stuck-goods-chip` 8px |
| hud.stuck-goods | css (none) | 12 | 12 | 24 | 0 | 0 | 0 | 0 | 0 | 0 | 0.97 | 0 | outside: image beyond the inner box — `button.stuck-goods-chip > span.stuck-goods-bell` 6px |
| hud.event-chips | flat (none) | 12 | 12 | 24 | 0 | 0 | 0 | 0 | 0 | 0 | 0.95 | 0 | outside: control beyond the inner box — `section.event-cards > div.event-chips > button.event-chip` 8px |
| hud.event-card | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.65 | 0 |  |
| hud.goal-chips | css (objective) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.71 | 0 |  |
| hud.goal-help | css | — | — |  |  |  |  |  |  |  | | | not reachable: the help seal shows only on a tutorial card whose step has an advisor line; the opening card, the one after it and the chapter goal cards (tutorial off) carry none, and later steps need buildings finished (UI-AUDIT-1 smoke runs) |
| hud.unlock-banner | css | — | — |  |  |  |  |  |  |  | | | not reachable: shows only when a tutorial step unlocks a tool; no scripted path completes one (survey §2: no browser script reaches it) |
| hud.pause-veil | painting (pause-badge) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.completion-toast | css (toast) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| hud.era-ceremony | flat | — | — |  |  |  |  |  |  |  | | | not reachable: shows only on the tick an era is entered; no cached state sits on that tick (survey §2: static contrast check only) |
| hud.cause-legend | flat (flat) | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.04 | 0 | outside: text beyond the inner box — `section.cause-legend > strong` 0.6px |
| hud.zone-toolbar | flat (flat) | 12 | 12 | 132 | 6 | 0 | 0 | 0 | 0 | 0 | 0.86 | 0 | outside: control beyond the inner box — `nav.zone-toolbar > div.zone-toolbar-kinds > button.zone-toolbar-button.zone-tool` 8px |
| hud.zone-land-legend | flat (flat) | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.74 | 0 | outside: text beyond the inner box — `p.zone-land-legend` 4px |
| hud.placement-confirm | flat (flat) | 4 | 4 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.72 | 0 | outside: control beyond the inner box — `div.placement-confirm-bar > button.placement-confirm-button` 2px |
| hud.prediction-chip | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.56 | 0 |  |
| hud.hover-tooltip | flat (flat) | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.build-drawer | css (strip-bottom) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.52 | 0 |  |
| hud.build-pinned | css (tooltip) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| hud.build-details | css | — | — |  |  |  |  |  |  |  | | | not reachable: the HUD's build drawer is controlled, which hides the details' toggle (BuildMenu.tsx: `open !== undefined`); nothing opens it in play |
| hud.qa-overlay | css (tooltip) | 12 | 12 | 24 | 0 | 0 | 0 | 0 | 0 | 0 | 0.29 | 0 | outside: text beyond the inner box — `section.qa-overlay > dl.qa-overlay-lines > div.qa-overlay-line > dt` 0.9px |
| slot.goals | css (slot) | 12 | 6 | 0 | 6 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 | overflow: a part scrolls (x) — `aside.slot-panel.goal-slot > section.goal-drawer` 7px |
| slot.goals.drawer | css (light) | 12 | 6 | 12 | 6 | 0 | 0 | 0 | 0 | 0 | 0.75 | 0 | outside: image beyond the inner box — `section.goal-drawer > section.settlement-status` 7.2px |
| slot.goals.status | css (toast) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.54 | 0 |  |
| slot.goals.settlement | flat (flat) | 12 | 12 | 24 | 12 | 0 | 0 | 0 | 0 | 0 | 0.56 | 0 | outside: control beyond the inner box — `section.settlement-progress > details.ui-disclosure > summary.ui-disclosure-summary` 8px |
| slot.goals.era-console | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.44 | 0 |  |
| slot.population | css (slot) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.population.panel | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.50 | 0 |  |
| slot.inspector | css (slot) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.inspector.body | css (light) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.39 | 0 |  |
| slot.ledger.stock | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.26 | 0 |  |
| slot.ledger.alerts | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.30 | 0 |  |
| slot.ledger.view | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.18 | 0 |  |
| slot.ledger.map | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.34 | 0 |  |
| slot.ledger.map-overview | css (dark) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.ledger.rights | css (rights) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.51 | 0 |  |
| slot.ledger.rights-decline | css (rights) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.46 | 0 |  |
| slot.ledger.wage | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.26 | 0 |  |
| slot.ledger.reorg | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.26 | 0 |  |
| slot.ledger.legacy | css (ledger) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.26 | 0 |  |
| map.selection.house | flat (flat) | 12 | 12 | 36 | 12 | 0 | 0 | 0 | 0 | 0 | 0.55 | 0 | outside: rule beyond the inner box — `aside.diagnostic-card > header.inspector-heading` 8px |
| map.selection.walker | flat (flat) | 12 | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0.30 | 0 | outside: rule beyond the inner box — `aside.diagnostic-card > header.inspector-heading` 8px |
| map.selection.site | flat (flat) | 12 | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0.31 | 0 | outside: rule beyond the inner box — `aside.diagnostic-card > header.inspector-heading` 8px |
| map.selection.farmstead | flat (flat) | 12 | 12 | 24 | 12 | 0 | 0 | 0 | 0 | 0 | 0.40 | 0 | outside: rule beyond the inner box — `aside.diagnostic-card > header.inspector-heading` 8px |
| map.selection.store | flat (flat) | 12 | 12 | 24 | 12 | 0 | 0 | 0 | 0 | 0 | 0.31 | 0 | outside: rule beyond the inner box — `aside.diagnostic-card > header.inspector-heading` 8px |
| modal.pause | css (modal) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.46 | 0 |  |
| modal.season-ledger | layer (season-ledger) | 12 | 12 | 0 | 30 | 0 | 0 | 0 | 0 | 0 | 0.51 | 0 | overflow: content wider than the surface — `section.season-ledger-card` 23px |
| modal.famine | flat (flat) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.56 | 0 |  |
| modal.petition.ch1 | layer (petition) | 12 | 12 | 0 | 36 | 0 | 0 | 24 | 0 | 0 | 0.73 | 0 | overflow: content wider than the surface — `section.story-modal.petition-card` 29px |
| modal.petition.ch2-war | layer (petition) | 12 | 12 | 0 | 36 | 0 | 0 | 39 | 0 | 0 | 0.65 | 0 | overflow: content wider than the surface — `section.story-modal.petition-card` 29px |
| modal.petition.ch4-reorg | layer (petition) | 12 | 12 | 0 | 36 | 0 | 0 | 36 | 0 | 0 | 0.61 | 0 | overflow: content wider than the surface — `section.story-modal.petition-card` 29px |
| modal.petition.ch5-legacy | layer (petition) | 12 | 12 | 0 | 30 | 0 | 0 | 27 | 0 | 0 | 0.62 | 0 | overflow: content wider than the surface — `section.story-modal.petition-card` 29px |
| modal.petition.heir | layer (petition) | 12 | 12 | 0 | 39 | 0 | 0 | 43 | 0 | 0 | 0.65 | 0 | overflow: content wider than the surface — `section.story-modal.petition-card` 29px |
| modal.chapter-page.ch1 | layer (chapter-page) | 12 | 12 | 0 | 36 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 | overflow: content wider than the surface — `section.chronicle-page` 16px |
| modal.chapter-page.ch2 | layer (chapter-page) | 12 | 12 | 0 | 36 | 0 | 0 | 2 | 0 | 0 | 0.32 | 0 | overflow: content wider than the surface — `section.chronicle-page` 16px |
| modal.chapter-page.ch3 | layer (chapter-page) | 12 | 12 | 0 | 34 | 0 | 0 | 18 | 0 | 0 | 0.32 | 0 | overflow: content wider than the surface — `section.chronicle-page` 16px |
| modal.chapter-page.ch4 | layer (chapter-page) | 12 | 12 | 0 | 30 | 0 | 0 | 32 | 0 | 0 | 0.33 | 0 | overflow: content wider than the surface — `section.chronicle-page` 16px |
| modal.chapter-page.ch5 | layer (chapter-page) | 12 | 12 | 0 | 36 | 0 | 0 | 96 | 0 | 0 | 0.40 | 0 | overflow: content wider than the surface — `section.chronicle-page` 16px |
| modal.chapter-preview | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.02 | 0 |  |
| modal.chapter-preview.goals | flat (flat) | 12 | 12 | 24 | 0 | 0 | 0 | 0 | 0 | 0 | 0.65 | 0 | outside: text beyond the inner box — `section.chapter-preview-goals > h3` 2px |
| modal.chapter-loading | flat (none) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.01 | 0 |  |
| modal.person-card | painting (person-card) | 12 | 12 | 36 | 24 | 24 | 12 | 0 | 0 | 0 | 0.30 | 0 | outside: control beyond the inner box — `section.person-card > div.person-card-art > div.person-card-actions > button.person-card-action` 17px |
| modal.history.records | flat (none) | 12 | 4 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0.68 | 0 | overlap: text over text — `div.chronicle-screen > section.chronicle-timeline-block > div.chronicle-strip-labels > span.chronicle-era-label ✕ div.chronicle-screen > section.chronicle-timeline-block > div.chronicle-strip-labels > span.chronicle-era-label` 9.8px |
| modal.history.record-card | layer (record-person) | 12 | 12 | 12 | 24 | 12 | 0 | 0 | 0 | 0 | 0.89 | 0 | outside: image beyond the inner box — `article.chronicle-card.chronicle-card--person > button.chronicle-card-body > span.chronicle-card-art.chronicle-card-art--portrait` 14px |
| modal.history.snapshot-map | layer (snapshot-320) | 12 | 12 | 12 | 24 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: image beyond the inner box — `div.chronicle-map-box > div.chronicle-map-inner > canvas.chronicle-map-canvas` 5px |
| modal.select-list | css (none) | 12 | 12 | 36 | 0 | 0 | 0 | 0 | 0 | 0 | 0.89 | 0 | outside: text beyond the inner box — `ul.ui-frame.ui-frame--light > li.ui-select-option` 4px |
| modal.history.decision | layer (decision) | 12 | 12 | 12 | 24 | 12 | 0 | 0 | 0 | 0 | 0.19 | 0 | outside: rule beyond the inner box — `section.chronicle-decision > div.chronicle-decision-art` 21px |
| modal.history.biography | painting (biography) | 12 | 12 | 0 | 24 | 0 | 0 | 0 | 0 | 0 | 0.20 | 0 | overflow: content wider than the surface — `article.chronicle-biography` 24px |
| modal.history.family-tree | flat (none) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.15 | 0 |  |
| modal.history.tree-banner | css (tree-banner) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.19 | 0 |  |
| modal.history.tree-generation | css (tree-generation) | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.35 | 0 | outside: text beyond the inner box — `span.family-tree-generation` 8px |
| modal.history.tree-node | css (tree-node) | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.73 | 0 |  |
| modal.history.factions | flat (none) | 12 | 12 | 156 | 12 | 0 | 0 | 0 | 0 | 0 | 0.79 | 0 | outside: rule beyond the inner box — `div.chronicle-factions > section.chronicle-factions-tug` 8px |
| modal.history.faction-page | painting (faction-page) | 12 | 12 | 0 | 48 | 0 | 0 | 4 | 0 | 0 | 0.34 | 0 | overflow: content wider than the surface — `article.chronicle-faction` 26px |
| modal.legacy-ending | layer (chapter-page) | 12 | 12 | 0 | 36 | 0 | 0 | 76 | 0 | 0 | 0.37 | 0 | overflow: content wider than the surface — `section.chronicle-page.legacy-ending` 16px |
| modal.chronicle-book | layer (chapter-page) | 12 | 12 | 0 | 36 | 0 | 0 | 0 | 0 | 0 | 0.33 | 0 | overflow: content wider than the surface — `section.chronicle-page.legacy-book` 16px |
| screen.welcome | css (modal) | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.52 | 0 |  |
| dev.ui-kit | css (light) | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.38 | 3 (TimeoutError: locator.waitFor: Timeout 60000ms exceeded.) |  |
| dev.ui-kit.section | css (light) | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.12 | 3 (not reached: dev.ui-kit failed (TimeoutError: locator.waitFor: Timeout 60000ms e) |  |
| dev.ui-kit.dark | css (dark) | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.10 | 3 (not reached: dev.ui-kit failed (TimeoutError: locator.waitFor: Timeout 60000ms e) |  |
| dev.ui-kit.tooltip | css (tooltip) | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.70 | 3 (not reached: dev.ui-kit failed (TimeoutError: locator.waitFor: Timeout 60000ms e) |  |

## Framed roots on screen that no registry row measures (0)

none

## Frame kind notes (11)

- hud.layer-switch: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.action-dock: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.crisis-icons: the root has no data-frame (a container: its own border and the 8 px gap)
- hud.stuck-goods: the root has no data-frame (measured by its border and border-image)
- hud.event-chips: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.chapter-preview: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.chapter-loading: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.records: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.select-list: the root has no data-frame (measured by its border and border-image)
- modal.history.family-tree: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.factions: the root has no data-frame (a container: its own border and the 8 px gap)
