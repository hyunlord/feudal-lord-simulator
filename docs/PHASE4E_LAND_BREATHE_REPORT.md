# Phase 4E — Let the Land Breathe

## Result

Phase 4E is release-ready. Open grass is the dominant settlement surface, deterministic ground cover fell from 853 to 154 benchmark objects, every road and building keeps a two-tile clearing, four compact cover sprites replaced the old shrub-only vocabulary, and the sawmill now reads as machinery rather than storage.

The simulation contract is unchanged: the economy harness still returns `4d92c66f9408a603`.

## Part 1 — Sparse deterministic cover

- Cover placement remains deterministic and now accepts only the top eight percent of eligible hashes (`roll >= 0.92`).
- A Chebyshev radius of two is protected around every building footprint and every road tile.
- Forest tiles never receive ground cover.
- The renderer reuses immutable cover descriptors when world geometry has not changed.
- The fixed benchmark contains 40 buildings, 127 roads, 451 trees, 154 cover objects, and 20 walkers.

## Part 2 — Cover and sawmill assets

Released cover:

- `shrub_a`: 40×28, low, wide, trunkless.
- `shrub_b`: 32×22, smaller and sparser, trunkless.
- `grass_tuft`: 28×18.
- `field_stone`: 24×16.

Each ground-cover subject was generated as four deterministic candidates. The reviewed winners are recorded in `docs/asset-evidence/phase4e_asset_selections.json`. The target-only release guard proves that no non-target PNG changed.

The sawmill alone was regenerated. Candidate 2 was rejected after adversarial visual review because its frame could read as a chimney or hoist. Candidate 5 supplies the open machinery-led body; deterministic release processing adds a pale toothed vertical blade inside the frame, three exterior plank courses, and a low sawdust patch. The storehouse and wheat farm were not changed.

Unchanged SHA-256 anchors:

- storehouse: `355a669cba6424ff939c02af40ead650d530b796c8541ba47dda9a94791d16be`
- wheat farm: `bafb0ce1a93d9467f9f02b8efde14f9b9218ab3d806d2f4d1f2b311ebbb4c59e`

Final sawmill SHA-256:

- `c5796f4ec19f81e5984cf701f39e1c237fcad41a7ccf102b0e65f81c828e2aac`

## Part 3 — Terrain texture and repeat strategy

Terrain now draws a flat semantic base first, then blends land texture at 45 percent. Water uses the same path at a restrained 18 percent.

Grass uses deterministic hashed 90-degree rotation. The first implementation changed orientation per tile and was rejected because it produced an obvious patch grid. The accepted implementation hashes broad 8×8 terrain regions, preserving deterministic rotation while removing tile-scale checkerboarding. Four transformed `CanvasPattern` variants are cached once per rendering context and source image.

Dual independent native-resolution visual review passed the corrected default and squint views: no obvious square grid remains, water stays secondary, shrubs do not resemble trees, and cover does not hide roads or buildings.

## Part 4 — DGX performance

Canonical 120-frame measurements after 20 warm-up frames:

| Stage | Speed | Cover | Average | p95 | Worst |
| --- | --- | ---: | ---: | ---: | ---: |
| Phase 4D baseline | 1x | 853 | 10.345ms | 11.4ms | 31.3ms |
| Phase 4D baseline | 5x | 853 | 10.448ms | 11.8ms | 14.3ms |
| Phase 4E Part 1 | 1x | 154 | 9.533ms | 10.3ms | 31.4ms |
| Phase 4E Part 1 | 5x | 154 | 9.647ms | 10.8ms | 13.2ms |
| Phase 4E final | 1x | 154 | 10.746ms | 11.4ms | 30.9ms |
| Phase 4E final | 5x | 154 | 10.655ms | 11.9ms | 14.3ms |

The first full-art measurement exceeded the 12ms average budget, so pattern transforms were cached instead of being reassigned per visible tile. Across three final runs, 1x averages were 10.688–10.746ms and 5x averages were 10.655–10.797ms. Rare worst-frame outliers remain visible in the evidence; none were removed or winsorized.

Raw summary evidence is in `docs/asset-evidence/phase4e_final_performance.json`; baseline and Part 1 runs remain in `docs/asset-evidence/phase4e_part1_performance.json`.

## Screenshots and visual read

- [Default open ground](assets/phase4e_default_open_ground.png)
- [Settlement clearing](assets/phase4e_settlement_clearing.png)
- [Sawmill beside unchanged storehouse](assets/phase4e_sawmill_storehouse.png)
- [Squint terrain](assets/phase4e_squint_terrain.png)

Honest read: the land now has a large calm center and scattered low punctuation instead of shrub noise. Dense forest still forms strong edge masses, but it frames rather than consumes the playfield. The 45-percent grass texture remains visible as fine vertical/organic grain; after the broad-region rotation change it no longer resolves into a tile grid at normal or squint distance. The sawmill is materially smaller than the storehouse and its blade, open face, planks, and sawdust are legible at native resolution.

The DGX browser run recorded zero page errors and zero failed requests. Chromium still asks Vite for the repository's pre-existing, unreferenced `/favicon.ico` and logs that single 404; no game, JS, CSS, manifest, or PNG request failed.

## Verification

- Node tests: 360/360 passed on DGX.
- Python generator tests: 12/12 passed on DGX.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run harness`: passed with `4d92c66f9408a603`.
- world-asset release verification: passed.
- target-only asset hash guard: passed.
- dual independent visual QA: passed after one corrective iteration.

Branch: `codex/phase4e-land-breathe`

Implementation tip before evidence-only report commit: `f95c594`.
