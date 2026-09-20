# Independent visual review — town-systems-v2

Verdict: **PASS for the inspected renderer correction and service-state presentation.** This is not an overall art approval or a claim that the entire city economy is stable.

## Evidence inspected

Opened initially: `occlusion/before.png`, `occlusion/after.png`. Reopened refreshed final captures: `grown-town-overview.png`, `grown-town-house.jpg`, `grown-town-church.jpg`, `grown-town-market.jpg`, `strained-house.jpg`, `recovered-house.jpg`. Final captures correspond to natural-state tick 415877 and interruption/recovery ticks 416278/416301 as identified by the capture owner. Read `occlusion/README.md`, all matrix data through a programmatic aggregate, `evidence/visual-diff.json`, and the actual product diff in `src/render/drawObjectRenderItems.ts`, `drawBuildings.ts`, `occlusionModel.ts`.

- The six-panel before/after image uses synthetic states with the actual product renderer and assets. It is not natural gameplay evidence.
- The grown-town images use normal UI loaded from a real-engine evolved state via an isolated initial-store override. They demonstrate that state in the product UI, not uninterrupted browser play from a new game.
- The strained/recovered images demonstrate the selected household's service interruption/recovery. The capture setup and interaction log remain the authoritative record of how those states were reached.

## Findings

1. **Roof road stripe removed.** The old image visibly paints a brown diagonal over the single-house roof, dense roofs and merged house. The matching after panels preserve the roof pixels and let roads disappear behind the buildings.
2. **Normal opacity restored.** The hover panel was translucent before and solid after. Dense houses also regain consistent solid walls and roofs. The code deletes automatic hover/density fading; explicit outline mode remains separate.
3. **Foreground walls remain physical.** The source change moves only ground road painting ahead of upright objects; it does not force wall objects behind all buildings. The wall queue remains intact. The front-wall panel remains in front of its scene. Matrix evidence includes 26 cases where foreground walls actually affect opaque building pixels, so a global walls-behind-houses workaround is not what was implemented.
4. **Normal whole-game inspection:** no obvious diagonal road paint crossing roofs or rear walls painted through opaque houses in the supplied overview and household captures. Road/wall placement still follows the game's angular grid; this pass does not make the town's overall geometry organic.
5. **Korean panel readability:** all inspected 1600×1100 desktop panels have readable CJK glyphs, appropriate wrapping, and visible bottom controls. The strained state says market/church have no connected road and reports living level 3 while retaining building level 4. The recovered state reports available market/church, living level 4 and good condition. This clearly communicates living state versus retained architecture.
6. **Final supply display:** the refreshed grown-town, strained and recovered screenshots now show water/bread **8/8 households**, population **256**, and the stable-settlement HUD instead of the earlier shortage warning. The old 5/8 and 7/8 caveat is superseded by these newly opened captures. The house panel confirms water, bread, market and church, with church **8/32** and the selected home's market **6/24**. A screenshot establishes the shown state; sustained stability still depends on the engine run evidence.
7. **Market evidence selection:** `grown-town-market.jpg` currently selects the outer legacy market and shows **0/24** served with **3/3** workers. This is internally compatible with other markets serving homes, but is a poor illustration of the new residential market coverage unless explicitly labeled. For a public explanation of market expansion, use the actual serving market's panel or the house panel's 6/24 market line. This does not block the renderer/service-state PASS.
8. **Remaining presentation detail:** the overview still shows an introductory well tutorial although supply is 8/8; subsequent house/church/market captures show the tutorial's completed summary. This review does not treat the overview tutorial prompt as a missing-water diagnostic.

## Quantitative corroboration and limits

- `matrix.json`: 240 actual-renderer synthetic cases; zero reported failures; no nonzero road/rear-wall opaque-interior writes; zero hot-cache, reversed input/path, and hover differences. There are 26 positive foreground-overlap cases.
- Matrix uses software Chrome and excludes a two-device-pixel edge region to avoid expected antialiasing. It is not universal GPU parity or all possible layouts.
- Before/after diff: 62,914 of 1,260,000 pixels changed (4.99%), matching opacity/paint-order changes. Similarity 95/100 alone is not the reason for PASS.
- No source edits performed by this reviewer. No mobile viewport, motion continuity, or exhaustive placement test was independently executed in this pass.

## Delivery evidence selection

After review, the delivered `grown-town-market.jpg` was replaced with `serving-market-market.png`, selecting construction-site-000025. Its actual inspector shows 6/24 served lots and workers3/3. The leader opened and checked that capture. The primary city image is `grown-town-house.jpg`; snapshot-only onboarding hints are not economic proof.
