# UI-AUDIT-1 geometry audit — render-UIAUDITR15-full-6a52380

Commit 6a523809, 101 registry rows, 1812 row × condition cells (5 viewports × 2 copy × 2 numbers where they apply), 46 min.
Against the committed baseline: 882 failure key(s) counted (20 more under 1 exception(s)); baseline 0, new 882, fixed 0.
Measured 1712, not opened 100, not reachable by design 4. Failures 1271: outside 2, overflow 32, border 0, portrait 0, overlap 0, empty 0, controls 0, content 900, hud 284, ornament 53. Empty-space warnings 542.

| surface | frame (data-frame) | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | content | hud | ornament | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.status-pill | css (tooltip) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.season-strip-panel | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| hud.time-cluster | css (strip-top) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.settings-popover | css (dark) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.38 | 0 |  |
| hud.layer-switch | flat (none) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.62 | 0 |  |
| hud.layer-switch-note | css (tooltip) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.50 | 0 |  |
| hud.action-dock | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.68 | 0 |  |
| hud.steward-bubble | css (advisor) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| hud.crisis-icons | flat (none) | 20 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0.70 | 0 | hud: the surface covers a live HUD control — `status-pill` 3px |
| hud.stuck-goods | css (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| hud.event-chips | flat (none) | 20 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 40 | 0 | 0.72 | 0 | hud: the surface covers a live HUD control — `crisis-icon.alert-stack-inspect` 2px |
| hud.event-card | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.65 | 0 |  |
| hud.goal-chips | css (objective) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.71 | 0 |  |
| hud.goal-help | css | — | — |  |  |  |  |  |  |  |  |  |  | | | not reachable: the help seal shows only on a tutorial card whose step has an advisor line; the opening card, the one after it and the chapter goal cards (tutorial off) carry none, and later steps need buildings finished (UI-AUDIT-1 smoke runs) |
| hud.unlock-banner | css | — | — |  |  |  |  |  |  |  |  |  |  | | | not reachable: shows only when a tutorial step unlocks a tool; no scripted path completes one (survey §2: no browser script reaches it) |
| hud.pause-veil | painting (pause-badge) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.completion-toast | css (toast) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| hud.era-ceremony | flat | — | — |  |  |  |  |  |  |  |  |  |  | | | not reachable: shows only on the tick an era is entered; no cached state sits on that tick (survey §2: static contrast check only) |
| hud.cause-legend | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| hud.zone-toolbar | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.70 | 0 |  |
| hud.zone-land-legend | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.76 | 0 |  |
| hud.placement-confirm | flat (flat) | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.67 | 0 |  |
| hud.prediction-chip | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.56 | 0 |  |
| hud.hover-tooltip | flat (flat) | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| hud.build-drawer | css (strip-bottom) | 20 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0.52 | 0 | hud: the HUD paints over the surface — `steward-line` 14.9px |
| hud.build-pinned | css (tooltip) | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 |  |
| hud.build-details | css | — | — |  |  |  |  |  |  |  |  |  |  | | | not reachable: the HUD's build drawer is controlled, which hides the details' toggle (BuildMenu.tsx: `open !== undefined`); nothing opens it in play |
| hud.qa-overlay | css (tooltip) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| slot.goals | css (slot) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.goals.drawer | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.67 | 0 |  |
| slot.goals.status | css (toast) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.54 | 0 |  |
| slot.goals.settlement | flat (flat) | 20 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 167 | 80 | 14 | 0.47 | 0 | content: text not painted (covered by another layer) — `section.era-console > dl.era-requirements > div.era-requirement.era-requirement--met > dt` 0px |
| slot.goals.era-console | flat (flat) | 20 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 153 | 80 | 12 | 0.44 | 0 | content: text not painted (covered by another layer) — `section.era-console > dl.era-requirements > div.era-requirement.era-requirement--met > dt` 0px |
| slot.population | css (slot) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.population.panel | flat (flat) | 20 | 19 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 34 | 0 | 4 | 0.50 | 0 | content: text not painted (covered by another layer) — `section.population-event-panel > h2` 0px |
| slot.inspector | css (slot) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.inspector.body | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.39 | 0 |  |
| slot.ledger.stock | css (ledger) | 20 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0.26 | 0 | hud: the surface covers a live HUD control — `steward-line` 8.5px |
| slot.ledger.alerts | css (ledger) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.30 | 0 |  |
| slot.ledger.view | css (ledger) | 20 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 0.19 | 0 | content: text not painted (covered by another layer) — `section.ledger-drawer.slot-panel > section.economy-overlays > span.overlay-heading` 0px |
| slot.ledger.map | css (ledger) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.34 | 0 |  |
| slot.ledger.map-overview | css (dark) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| slot.ledger.rights | css (rights) | 20 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 92 | 65 | 11 | 0.51 | 0 | content: text not painted (covered by another layer) — `section.ledger-rights > div.ledger-rights-page > h4` 0px |
| slot.ledger.rights-decline | css (rights) | 20 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | 0 | 0.43 | 0 | hud: the HUD paints over the surface — `steward-line` 18.8px |
| slot.ledger.wage | css (ledger) | 20 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 36 | 0 | 0 | 0.26 | 0 | content: text not painted (covered by another layer) — `table.ledger-matrix > tbody > tr > td.ledger-total` 0px |
| slot.ledger.reorg | css (ledger) | 20 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 36 | 0 | 0 | 0.26 | 0 | content: text not painted (covered by another layer) — `table.ledger-matrix > tbody > tr > td.ledger-total` 0px |
| slot.ledger.legacy | css (ledger) | 20 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 36 | 0 | 0 | 0.26 | 0 | content: text not painted (covered by another layer) — `table.ledger-matrix > tbody > tr > td.ledger-total` 0px |
| map.selection.house | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.49 | 0 |  |
| map.selection.walker | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 |  |
| map.selection.site | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.30 | 0 |  |
| map.selection.farmstead | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.40 | 0 |  |
| map.selection.store | css (light) | 20 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 0 | 0 | 0.31 | 0 | content: text not painted (covered by another layer) — `tbody > tr > th > span.store-stock-name` 0px |
| modal.pause | css (modal) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.46 | 0 |  |
| modal.season-ledger | layer (season-ledger) | 20 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 200 | 0 | 10 | 0.51 | 0 | content: required h2 not painted (covered by another layer) — `h2` 0px |
| modal.famine | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.56 | 0 |  |
| modal.petition.ch1 | layer (petition) | 20 | 4 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.70 | 0 | overflow: a part scrolls (y) — `section.story-modal.petition-card > div.petition-body` 27px |
| modal.petition.ch2-war | layer (petition) | 20 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.63 | 0 | overflow: a part scrolls (y) — `section.story-modal.petition-card > div.petition-body` 46px |
| modal.petition.ch4-reorg | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.60 | 0 |  |
| modal.petition.ch5-legacy | layer (petition) | 20 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.62 | 0 | overflow: a part scrolls (y) — `section.story-modal.petition-card > div.petition-body` 8px |
| modal.petition.heir | layer (petition) | 20 | 4 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.49 | 0 | overflow: a part scrolls (y) — `section.story-modal.petition-card > div.petition-body` 5px |
| modal.petition.ch3-plague | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.57 | 0 |  |
| modal.petition.ch4-guild | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.65 | 0 |  |
| modal.petition.ch5-royal-tax | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.54 | 0 |  |
| modal.petition.ch5-legacy-choice | layer (petition) | 20 | 2 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.63 | 0 | overflow: a part scrolls (y) — `section.story-modal.petition-card > div.petition-body` 2px |
| modal.petition.interlude-guild | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.50 | 0 |  |
| modal.petition.interlude-church | layer (petition) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.50 | 0 |  |
| modal.chapter-page.ch1 | layer (chapter-page) | 20 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 | 0 | 0.28 | 0 | content: text not painted (covered by another layer) — `section > ol.chronicle-timeline > li.chronicle-entry > span.chronicle-entry-date` 0px |
| modal.chapter-page.ch2 | layer (chapter-page) | 20 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 | 0 | 0.32 | 0 | content: text not painted (covered by another layer) — `section > ol.chronicle-timeline > li.chronicle-entry > span.chronicle-entry-date` 0px |
| modal.chapter-page.ch3 | layer (chapter-page) | 20 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 0 | 0.32 | 0 | content: text not painted (covered by another layer) — `section > ol.chronicle-timeline > li.chronicle-entry > span.chronicle-entry-line` 0px |
| modal.chapter-page.ch4 | layer (chapter-page) | 20 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0.34 | 0 | content: text not painted (covered by another layer) — `div.chronicle-columns > section > ul.chronicle-stats > li` 0px |
| modal.chapter-page.ch5 | layer (chapter-page) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.39 | 0 |  |
| modal.chapter-preview | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.02 | 0 |  |
| modal.chapter-preview.goals | flat (flat) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.62 | 0 |  |
| modal.chapter-loading | flat (none) | 10 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 2 | 0.01 | 0 | content: text not painted (covered by another layer) — `div.chapter-loading > p.chapter-loading-title` 0px |
| modal.person-card | painting (person-card) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.43 | 0 |  |
| modal.history.records | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.64 | 0 |  |
| modal.history.record-card | layer (record-person) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.67 | 0 |  |
| modal.history.snapshot-map | layer (snapshot-320) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| modal.history.snapshot-figure | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.96 | 0 |  |
| modal.select-list | css (light) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 |  |
| modal.history.decision | layer (decision) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.18 | 0 |  |
| modal.history.biography | painting (biography) | 20 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0.20 | 0 | content: text not painted (covered by another layer) — `article.chronicle-biography > div.chronicle-page-art > header.chronicle-biography-header > p.chronicle-biography-office` 0px |
| modal.person-card.king | painting (person-card) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.40 | 0 |  |
| modal.history.biography.king | painting (biography) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.13 | 0 |  |
| modal.history.family-tree | flat (none) | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.15 | 0 |  |
| modal.history.tree-banner | css () | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  | 20 (Error: page.screenshot: Clipped area is either empty or outside the resulting im) |  |
| modal.history.tree-generation | css () | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  | 20 (not reached: modal.history.tree-banner failed (Error: page.screenshot: Clipped a) |  |
| modal.history.tree-node | css () | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  | 20 (not reached: modal.history.tree-banner failed (Error: page.screenshot: Clipped a) |  |
| modal.history.factions | flat (none) | 20 | 20 | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 32 | 0 | 0 | 0.75 | 0 | overflow: a part scrolls (x) — `div.chronicle-factions > section.chronicle-world > ol.chronicle-world-strip` 1034px |
| modal.history.faction-page | painting (faction-page) | 20 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 | 0 | 0.34 | 0 | content: text not painted (covered by another layer) — `section.chronicle-faction-box > ul > li > span.chronicle-faction-date` 0px |
| modal.legacy-ending | layer (chapter-page) | 20 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0.36 | 0 | content: text not painted (covered by another layer) — `ul.legacy-axes > li.legacy-axis > ul.legacy-axis-parts > li` 0px |
| modal.chronicle-book | layer (chapter-page) | 20 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0.32 | 0 | content: control not painted (covered by another layer) — `div.legacy-book-title-page > ol.legacy-book-contents > li > button.legacy-book-contents-entry` 0px |
| modal.chronicle-book.chapter | layer (chapter-page) | 20 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0.21 | 0 | content: text not painted (covered by another layer) — `section > ol.legacy-book-lines > li.legacy-book-line > span.legacy-book-text` 0px |
| modal.chronicle-book.family | layer (chapter-page) | 20 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 11 | 0 | 0 | 0.20 | 0 | content: text not painted (covered by another layer) — `article.legacy-book-page > div.legacy-book-family > section.legacy-book-house > h3` 0px |
| modal.chronicle-book.factions | layer (chapter-page) | 20 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0.18 | 0 | content: text not painted (covered by another layer) — `section.legacy-book-faction > ol.legacy-book-lines > li.legacy-book-line > span.legacy-book-text` 0px |
| modal.chronicle-book.legacy | layer (chapter-page) | 20 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0.21 | 0 | content: text not painted (covered by another layer) — `div.legacy-ending-block > ol.legacy-quotes > li.legacy-quote > span.legacy-quote-date` 0px |
| screen.welcome | css (modal) | 10 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.51 | 0 | outside: text beyond the inner box — `section.welcome-parchment > h2` 0.7px |
| dev.ui-kit | css () | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  | 10 (Error: page.screenshot: Clipped area is either empty or outside the resulting im) |  |
| dev.ui-kit.section | css () | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  | 10 (not reached: dev.ui-kit failed (Error: page.screenshot: Clipped area is either e) |  |
| dev.ui-kit.dark | css () | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  | 10 (not reached: dev.ui-kit failed (Error: page.screenshot: Clipped area is either e) |  |
| dev.ui-kit.tooltip | css () | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  | 10 (not reached: dev.ui-kit failed (Error: page.screenshot: Clipped area is either e) |  |

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
- modal.history.snapshot-figure: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.family-tree: the root has no data-frame (a container: its own border and the 8 px gap)
- modal.history.factions: the root has no data-frame (a container: its own border and the 8 px gap)
