# UI-AUDIT-1 fix group A — evidence

- `person-card-*-{desk,tablet}-{before,after}.jpg`: the person card at 1280×800 and the tablet (1180×820, touch). There are three cards: a house member (`person-card-*`), the steward wearing the key ornament (`-steward-`, the user's screenshot), and the lord with the house's arms (`-lord-`). The before shots are from the phase-2 base 9523b92d; the after shots are from c54d7afe (scripts/uiauditFixaCaptures.mjs on the DGX).
- `hud-{desk,tablet}-{before,after}-{left,right}.jpg`: the HUD's top corners, before and after. `captures.json` holds the boxes (the status pill, the goal rail, the speed cluster and the crisis row) and each card's computed border and padding. The tablet's 48 px targets were fixed after these shots (2d883ea3), so the tablet pill cells still measure 44 px here.
- `hud-coverage-after.json`: scripts/measureHudCoverage.ts on 2d883ea3.
- `audit/*.md`: the geometry audit's subset tables for this branch.
  - `m-6972505`: the merged tree, every group A row.
  - `v-0234fa7` and `v2-c54d7af`: re-runs of the rows fixed after that.
  - `t-2d883ea`: the tablet with every hud and ledger row.
