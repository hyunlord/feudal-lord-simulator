# C1f gate ② — wheat farm retired (migrated save, before / after)

Save fixture `fixtures/saves/v9/four-farms.save.json` (seed 2, tick 15162, four 2x2 wheat farms at 45,34 · 42,39 · 51,37 · 41,32), camera on tile 46,36, zoom 1, 1280x800, paused, walkers hidden.

- `before-c1e-v9-z1.00.jpg`: the C1e build (`79bb3ec`, save schema v9) with the save's own v9 state: the four square wheat farm paintings.
- `after-c1f-migrated-z1.00.jpg`: this build with the same save decoded by `decodeSave` (v9 -> v10, C1c-2 migration): 0 wheat_farm buildings, the farm ground is four arable zones (fallow, winter) and a farmstead at 45,35 — no square farm art anywhere.

The trunk build (`dacbed3`) was not used for "before": it already migrates the save, so it shows no wheat farm either and the pair would not show the retirement.
Automatic check: `tests/wheatFarmRetired.test.ts` (runtime manifests, public/assets, render sources, every save fixture migrated).
