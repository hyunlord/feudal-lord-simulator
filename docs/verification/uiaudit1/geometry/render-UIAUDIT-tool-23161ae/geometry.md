# UI-AUDIT-1 geometry audit — render-UIAUDIT-tool-23161ae

Commit 23161ae8, 76 registry rows, 810 row × condition cells (3 viewports × 2 copy × 2 numbers where they apply), 41 min.
Measured 795, not opened 15, not reachable by design 4. Failures 4887: outside 3658, overflow 269, border 556, portrait 12, overlap 392, empty 0, controls 0. Empty-space warnings 256.

| surface | frame | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.status-pill | css | 12 | 12 | 100 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: image beyond the inner box — `nav.status-pill > button.status-pill-cell.status-pill-date > span.status-pill-date-text > span.ui-icon` 8px |
| hud.season-strip-panel | css | 12 | 12 | 102 | 0 | 72 | 0 | 0 | 0 | 0 | 0.30 | 0 | outside: image beyond the inner box — `section.season-strip-panel > div.season-strip-full` 11px |
| hud.time-cluster | css | 12 | 12 | 60 | 12 | 60 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: control beyond the inner box — `div.hud-time-cluster > div.speed-control-stack > div.speed-seals > button.speed-seal` 19px |
| hud.settings-popover | css | 12 | 12 | 208 | 4 | 4 | 0 | 8 | 0 | 0 | 0.38 | 0 | outside: control beyond the inner box — `div.command-popover.autoplay-control > button.autoplay-toggle` 6px |
| hud.layer-switch | flat | 6 | 6 | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: control beyond the inner box — `div.layer-switch > button.control-layer` 8px |
| hud.layer-switch-note | css | 6 | 6 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.59 | 0 | outside: image beyond the inner box — `p.layer-switch-note > span.ui-icon` 7px |
| hud.action-dock | flat | 12 | 12 | 48 | 0 | 0 | 0 | 0 | 0 | 0 | 0.97 | 0 | outside: control beyond the inner box — `nav.action-dock > button.action-dock-button` 8px |
| hud.steward-bubble | css | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.33 | 0 | outside: control beyond the inner box — `aside.steward-advisor.steward-bubble > button.steward-button` 6px |
| hud.crisis-icons | flat | 12 | 12 | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 0.95 | 0 | outside: control beyond the inner box — `section.crisis-icons > button.crisis-icon.alert-stack-inspect` 8px |
| hud.event-chips | flat | 12 | 12 | 24 | 0 | 0 | 0 | 0 | 0 | 0 | 0.95 | 0 | outside: control beyond the inner box — `section.event-cards > div.event-chips > button.event-chip` 8px |
| hud.event-card | css | 12 | 12 | 72 | 0 | 48 | 0 | 0 | 0 | 0 | 0.68 | 0 | outside: image beyond the inner box — `article.event-card > div.event-card-art` 11px |
| hud.goal-chips | css | 6 | 6 | 12 | 0 | 6 | 0 | 0 | 0 | 0 | 0.61 | 0 | outside: control beyond the inner box — `article.goal-card > div.goal-card-actions > button.goal-card-cta` 22px |
| hud.goal-help | css | — | — |  |  |  |  |  |  |  | | | not reachable: the help seal shows only on a tutorial card whose step has an advisor line; the opening card, the one after it and the chapter goal cards (tutorial off) carry none, and later steps need buildings finished (UI-AUDIT-1 smoke runs) |
| hud.unlock-banner | css | — | — |  |  |  |  |  |  |  | | | not reachable: shows only when a tutorial step unlocks a tool; no scripted path completes one (survey §2: no browser script reaches it) |
| hud.pause-veil | css | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.98 | 0 | outside: text beyond the inner box — `span.pause-veil-label` 8px |
| hud.completion-toast | css | 6 | 6 | 12 | 0 | 6 | 0 | 0 | 0 | 0 | 1.00 | 6 (TimeoutError: locator.click: Timeout 30000ms exceeded.) | outside: image beyond the inner box — `div.completion-toast > span.ui-icon` 10px |
| hud.era-ceremony | flat | — | — |  |  |  |  |  |  |  | | | not reachable: shows only on the tick an era is entered; no cached state sits on that tick (survey §2: static contrast check only) |
| hud.cause-legend | flat | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.04 | 0 | outside: text beyond the inner box — `section.cause-legend > strong` 0.6px |
| hud.zone-toolbar | flat | 12 | 12 | 132 | 6 | 0 | 0 | 0 | 0 | 0 | 0.86 | 0 | outside: control beyond the inner box — `nav.zone-toolbar > div.zone-toolbar-kinds > button.zone-toolbar-button.zone-tool` 8px |
| hud.zone-land-legend | flat | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.74 | 0 | outside: text beyond the inner box — `p.zone-land-legend` 4px |
| hud.placement-confirm | flat | 4 | 4 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.71 | 0 | outside: control beyond the inner box — `div.placement-confirm-bar > button.placement-confirm-button` 2px |
| hud.prediction-chip | css | 12 | 12 | 54 | 0 | 24 | 0 | 0 | 0 | 0 | 0.81 | 0 | outside: image beyond the inner box — `aside.prediction-panel.placement-chip > p.placement-chip-reason > span.ui-icon` 13px |
| hud.hover-tooltip | flat | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.97 | 0 |  |
| hud.build-drawer | css | 12 | 12 | 96 | 0 | 96 | 0 | 0 | 0 | 0 | 0.49 | 0 | outside: control beyond the inner box — `div.build-menu > div.build-menu-toprow > div.build-menu-categories > button.build-menu-category` 14px |
| hud.build-pinned | css | 6 | 6 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.38 | 0 | outside: image beyond the inner box — `p.build-menu-pinned.build-menu-lock-note > span.ui-icon` 6px |
| hud.build-details | css | — | — |  |  |  |  |  |  |  | | | not reachable: the HUD's build drawer is controlled, which hides the details' toggle (BuildMenu.tsx: `open !== undefined`); nothing opens it in play |
| hud.qa-overlay | css | 12 | 12 | 144 | 0 | 0 | 0 | 0 | 0 | 0 | 0.30 | 0 | outside: control beyond the inner box — `section.qa-overlay > div.qa-overlay-actions > button.qa-overlay-copy` 5px |
| slot.goals | css | 12 | 12 | 12 | 6 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: image beyond the inner box — `aside.slot-panel.goal-slot > section.goal-drawer` 5px |
| slot.goals.settlement | flat | 12 | 12 | 24 | 12 | 0 | 0 | 0 | 0 | 0 | 0.59 | 0 | outside: control beyond the inner box — `section.settlement-progress > details.ui-disclosure > summary.ui-disclosure-summary` 8px |
| slot.goals.era-console | flat | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.45 | 0 |  |
| slot.population | css | 12 | 12 | 12 | 0 | 12 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: rule beyond the inner box — `div.ledger-population-drawer.slot-panel > section.population-event-panel` 9px |
| slot.inspector | css | 12 | 12 | 12 | 0 | 12 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: image beyond the inner box — `div.slot-panel.inspector-slot > section.left-inspector` 8.6px |
| slot.ledger.stock | css | 12 | 12 | 216 | 0 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 | outside: control beyond the inner box — `section.ledger-drawer.slot-panel > header.slot-panel-heading > button.slot-panel-close` 5px |
| slot.ledger.alerts | css | 12 | 12 | 84 | 0 | 0 | 0 | 0 | 0 | 0 | 0.32 | 0 | outside: control beyond the inner box — `section.ledger-drawer.slot-panel > header.slot-panel-heading > button.slot-panel-close` 5px |
| slot.ledger.view | css | 12 | 12 | 120 | 0 | 0 | 0 | 0 | 0 | 0 | 0.20 | 0 | outside: control beyond the inner box — `section.ledger-drawer.slot-panel > header.slot-panel-heading > button.slot-panel-close` 5px |
| slot.ledger.map | css | 12 | 12 | 48 | 0 | 0 | 0 | 0 | 0 | 0 | 0.36 | 0 | outside: control beyond the inner box — `section.ledger-drawer.slot-panel > header.slot-panel-heading > button.slot-panel-close` 5px |
| slot.ledger.map-overview | css | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: image beyond the inner box — `button.map-overview > svg` 8px |
| slot.ledger.rights | css | 12 | 12 | 17 | 0 | 0 | 0 | 0 | 0 | 0 | 0.53 | 0 | outside: text beyond the inner box — `div.ledger-rights-page > header.ledger-rights-house > div > p.ledger-rights-house-name` 4px |
| slot.ledger.rights-decline | css | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0.45 | 0 | outside: text beyond the inner box — `div.ledger-rights-page > header.ledger-rights-house > div > p.ledger-rights-house-name` 4px |
| slot.ledger.wage | css | 12 | 12 | 276 | 0 | 12 | 0 | 0 | 0 | 0 | 0.28 | 0 | outside: control beyond the inner box — `section.ledger-drawer.slot-panel > header.slot-panel-heading > button.slot-panel-close` 5px |
| slot.ledger.reorg | css | 12 | 12 | 300 | 0 | 60 | 0 | 0 | 0 | 0 | 0.28 | 0 | outside: control beyond the inner box — `section.ledger-drawer.slot-panel > header.slot-panel-heading > button.slot-panel-close` 5px |
| slot.ledger.legacy | css | 12 | 12 | 300 | 0 | 60 | 0 | 0 | 0 | 0 | 0.28 | 0 | outside: control beyond the inner box — `section.ledger-drawer.slot-panel > header.slot-panel-heading > button.slot-panel-close` 5px |
| map.selection.house | flat | 12 | 12 | 36 | 12 | 0 | 0 | 0 | 0 | 0 | 0.55 | 0 | outside: rule beyond the inner box — `aside.diagnostic-card > header.inspector-heading` 8px |
| map.selection.walker | flat | 12 | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0.30 | 0 | outside: rule beyond the inner box — `aside.diagnostic-card > header.inspector-heading` 8px |
| map.selection.site | flat | 12 | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0.31 | 0 | outside: rule beyond the inner box — `aside.diagnostic-card > header.inspector-heading` 8px |
| map.selection.farmstead | flat | 12 | 12 | 24 | 12 | 0 | 0 | 0 | 0 | 0 | 0.40 | 0 | outside: rule beyond the inner box — `aside.diagnostic-card > header.inspector-heading` 8px |
| map.selection.store | flat | 12 | 12 | 24 | 12 | 0 | 0 | 0 | 0 | 0 | 0.31 | 0 | outside: rule beyond the inner box — `aside.diagnostic-card > header.inspector-heading` 8px |
| modal.pause | css | 12 | 12 | 72 | 0 | 0 | 0 | 0 | 0 | 0 | 0.48 | 0 | outside: control beyond the inner box — `section.pause-menu > button.pause-menu-resume` 3px |
| modal.season-ledger | layer | 6 | 6 | 42 | 0 | 0 | 0 | 0 | 0 | 0 | 0.49 | 6 (TimeoutError: locator.click: Timeout 30000ms exceeded.) | outside: control beyond the inner box — `section.season-ledger-card > div.season-ledger-body > div.season-ledger-actions > button.season-ledger-resume` 6px |
| modal.famine | flat | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.53 | 0 |  |
| modal.petition.ch1 | layer | 12 | 12 | 36 | 12 | 0 | 0 | 24 | 0 | 0 | 0.73 | 0 | outside: control beyond the inner box — `div.petition-body > ol.petition-options > li > button.petition-option` 8px |
| modal.petition.ch2-war | layer | 12 | 12 | 30 | 12 | 0 | 0 | 39 | 0 | 0 | 0.65 | 0 | outside: image beyond the inner box — `section.story-modal.petition-card > div.petition-body > div.petition-scene > div.story-modal-art` 4px |
| modal.petition.ch4-reorg | layer | 12 | 12 | 30 | 12 | 0 | 0 | 33 | 0 | 0 | 0.61 | 0 | outside: image beyond the inner box — `section.story-modal.petition-card > div.petition-body > div.petition-scene > div.story-modal-art` 4px |
| modal.petition.ch5-legacy | layer | 12 | 12 | 21 | 6 | 0 | 0 | 24 | 0 | 0 | 0.62 | 0 | outside: image beyond the inner box — `section.story-modal.petition-card > div.petition-body > div.petition-scene > div.story-modal-art` 4px |
| modal.petition.heir | layer | 12 | 12 | 39 | 15 | 0 | 0 | 38 | 0 | 0 | 0.65 | 0 | outside: image beyond the inner box — `section.story-modal.petition-card > div.petition-body > div.petition-scene > div.story-modal-art` 4px |
| modal.chapter-page.ch1 | layer | 12 | 12 | 24 | 12 | 0 | 0 | 0 | 0 | 0 | 0.28 | 0 | outside: rule beyond the inner box — `section.chronicle-page > div.chapter-page-body > div.chronicle-page-footer` 8px |
| modal.chapter-page.ch2 | layer | 12 | 12 | 24 | 12 | 0 | 0 | 2 | 0 | 0 | 0.32 | 0 | outside: rule beyond the inner box — `section.chronicle-page > div.chapter-page-body > div.chronicle-page-footer` 8px |
| modal.chapter-page.ch3 | layer | 12 | 12 | 24 | 10 | 0 | 0 | 18 | 0 | 0 | 0.32 | 0 | outside: rule beyond the inner box — `section.chronicle-page > div.chapter-page-body > div.chronicle-page-footer` 8px |
| modal.chapter-page.ch4 | layer | 12 | 12 | 24 | 6 | 0 | 0 | 30 | 0 | 0 | 0.34 | 0 | outside: rule beyond the inner box — `section.chronicle-page > div.chapter-page-body > div.chronicle-page-footer` 8px |
| modal.chapter-page.ch5 | layer | 12 | 12 | 40 | 12 | 0 | 0 | 94 | 0 | 0 | 0.40 | 0 | outside: rule beyond the inner box — `section.chronicle-page > div.chapter-page-body > div.chronicle-page-footer` 8px |
| modal.chapter-preview | flat | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.02 | 0 |  |
| modal.chapter-loading | flat | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.01 | 0 |  |
| modal.person-card | painting | 12 | 12 | 36 | 0 | 24 | 12 | 0 | 0 | 0 | 0.30 | 0 | outside: control beyond the inner box — `section.person-card > div.person-card-actions > button.person-card-action` 16.5px |
| modal.history.records | flat | 12 | 4 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0.68 | 0 | overlap: text over text — `div.chronicle-screen > section.chronicle-timeline-block > div.chronicle-strip-labels > span.chronicle-era-label ✕ div.chronicle-screen > section.chronicle-timeline-block > div.chronicle-strip-labels > span.chronicle-era-label` 9.8px |
| modal.history.record-card | layer | 12 | 12 | 72 | 0 | 48 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: image beyond the inner box — `article.chronicle-card.chronicle-card--person > button.chronicle-card-body > span.chronicle-card-art.chronicle-card-art--portrait` 63.2px |
| modal.history.snapshot-map | layer | 12 | 12 | 24 | 0 | 12 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: image beyond the inner box — `figure.chronicle-map > div.chronicle-map-box > div.chronicle-map-inner > canvas.chronicle-map-canvas` 13px |
| modal.select-list | css | 12 | 12 | 48 | 0 | 0 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: text beyond the inner box — `ul.ui-frame.ui-frame--light > li.ui-select-option` 3px |
| modal.history.decision | layer | 12 | 12 | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 0.18 | 0 | outside: text beyond the inner box — `section.chronicle-decision > div.chronicle-decision-column > h4` 14px |
| modal.history.biography | painting | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.20 | 0 |  |
| modal.history.family-tree | flat | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.15 | 0 |  |
| modal.history.factions | flat | 12 | 12 | 156 | 12 | 0 | 0 | 0 | 0 | 0 | 0.79 | 0 | outside: rule beyond the inner box — `div.chronicle-factions > section.chronicle-factions-tug` 8px |
| modal.history.faction-page | painting | 12 | 12 | 0 | 24 | 0 | 0 | 4 | 0 | 0 | 0.32 | 0 | overflow: a part scrolls (y) — `article.chronicle-faction > section.chronicle-faction-box.chronicle-faction-box--memory > ul` 106px |
| modal.legacy-ending | layer | 12 | 12 | 32 | 12 | 0 | 0 | 74 | 0 | 0 | 0.37 | 0 | outside: rule beyond the inner box — `section.chronicle-page.legacy-ending > div.chapter-page-body.legacy-ending-body > div.legacy-ending-footer` 8px |
| modal.chronicle-book | layer | 12 | 12 | 60 | 12 | 0 | 0 | 0 | 0 | 0 | 0.34 | 0 | outside: control beyond the inner box — `section.chronicle-page.legacy-book > div.legacy-book-body > header.legacy-book-header > button.legacy-export` 8px |
| screen.welcome | css | 6 | 6 | 21 | 0 | 0 | 0 | 0 | 0 | 0 | 0.52 | 0 | outside: control beyond the inner box — `section.welcome-parchment > div.tutorial-toggle > button.tutorial-switch` 2px |
| dev.ui-kit | css | 3 | 3 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0.55 | 3 (TimeoutError: locator.waitFor: Timeout 60000ms exceeded.) | outside: text beyond the inner box — `div.ui-kit-gallery-frame.ui-frame > strong` 5px |
