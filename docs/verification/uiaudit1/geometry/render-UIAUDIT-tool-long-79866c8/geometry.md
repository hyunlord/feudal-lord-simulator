# UI-AUDIT-1 geometry audit — render-UIAUDIT-tool-long-79866c8

Commit 79866c8b, 2 registry rows, 12 row × condition cells (3 viewports × 1 copy × 2 numbers where they apply), 1 min.
Measured 12, not opened 0, not reachable by design 0. Failures 64: outside 54, overflow 4, border 6, portrait 0, overlap 0, empty 0, controls 0. Empty-space warnings 0.

| surface | frame | measured | failing conditions | outside | overflow | border | portrait | overlap | empty | controls | empty (min) | not opened | first failure |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hud.completion-toast | css | 6 | 6 | 12 | 0 | 6 | 0 | 0 | 0 | 0 | 1.00 | 0 | outside: image beyond the inner box — `div.completion-toast > span.ui-icon` 10px |
| modal.season-ledger | layer | 6 | 6 | 42 | 4 | 0 | 0 | 0 | 0 | 0 | 0.71 | 0 | outside: control beyond the inner box — `section.season-ledger-card > div.season-ledger-body > div.season-ledger-actions > button.season-ledger-resume` 6px |
