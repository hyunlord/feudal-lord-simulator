# Core migration runtime visual review — v3

Reviewed 2026-10-05 in `/Users/rexxa/fls-astra-renderB`. Read-only review; this lane wrote only this report. No product changes, browser runs, remote commands, or tests were performed by this reviewer.

**Verdict: PASS for visual preservation across the 28 captured scenes, with pre-existing visibility limits below.** Each baseline JPEG and each corresponding core JPEG was individually opened through `view_image`: 56 actual context images, not a contact-sheet or manifest-only review. No new visible clipping, missing sprite rectangle, displacement, path interruption, seasonal mismatch, or house/snow alignment change was observed between corresponding scenes. This is a bounded migration result, not blanket approval of existing art or proof of every hidden pixel.

Evidence read:

- Baseline: `output/art-architecture/before-v3/captures.json` and its 28 named JPEGs; paired lossless PNGs available.
- Core: `output/art-architecture/core-v3/captures.json` and its 28 named JPEGs; paired lossless PNGs available.
- Both capture manifests report `pass: true`, 28 stable views, 28 passing same-build repeat comparisons, no top-level errors, and no per-view errors. Views are 1280×800, DPR 1, Chromium 151.0.7922.34, `headless-disable-gpu`, capture protocol 3, frozen visual time.
- Parent-executed exact comparator: `output/art-architecture/core-pixels-v3.json`. Independently read all 28 rows: `pass: true`, no issues, same dimensions, **0 differing RGBA pixels and maximum channel delta 0 in every row**. Parent reports command `node_modules/.bin/tsx scripts/artPixelCompare.mjs output/art-architecture/before-v3 output/art-architecture/core-v3 --out output/art-architecture/core-pixels-v3.json`, exit 0. Reviewer did not rerun it.
- Both manifests label base commit `d4973e85d3d4039cf6f8091c33c1047239e443ee`; that shared HEAD field alone does not identify uncommitted migration source content. Parent's build/source provenance remains the evidence for which working-tree changes were deployed.

## Individual scene log

Every row means both `before-v3/<scene>.jpg` and `core-v3/<scene>.jpg` were individually opened. The corresponding `<scene>.png` comparator row passes exactly. `PASS + NOTE` indicates preservation passed while an existing quality or coverage limit remains.

| Scene basename | Verdict | Actual visible observation / limit, present before and after |
|---|---|---|
| forest-y0-summer-z1 | PASS + NOTE | Dense settlement occupies right; mature trees on open grass and cut-stump rows at upper/lower edges; thin diagonal path to manor. Rightmost town and border forest cropped. Blank white-wall manor primitive above town is pre-existing. |
| forest-y0-summer-z06 | PASS + NOTE | Wider lake, settlement and forest rim visible; pale fresh-stump heads readable in regular rows; small regrowth details difficult to identify individually. Manor primitive persists. |
| forest-y0-winter-z1 | PASS + NOTE | Snow roofs, bare trees, snowy stump rims and thin path present. Foreground farm appears in this winter saved state; summer/winter are not identical simulation inputs. Right-side town cropped. |
| forest-y0-winter-z06 | PASS + NOTE | Broad forest rim shows pale stumps and bare regrowth. Gray ground belt and regular forest rows visibly persist; detail recognition limited at reduced zoom. |
| forest-y2-summer-z1 | PASS + NOTE | Crop field left, zigzag paths north and lower right, young greenery around forest edge. Northern paths partially hidden by HUD/manor; town cropped at right. |
| forest-y2-summer-z06 | PASS + NOTE | Wide green regrowth strips and cut-stump bands around forest rim; angular connected path network visible near manor/town. Strong row repetition is already in baseline. |
| forest-y2-winter-z1 | PASS + NOTE | Bare/brown regrowth near lower/right border, snow roofs, winter field and north path network visible. Border/HUD cropping prevents full network inspection. |
| forest-y2-winter-z06 | PASS + NOTE | Brown regrowth strips and pale stump rows distinguish larger stage bands; tiny branches not individually readable. Same gray ground boundary and manor primitive. |
| prepared-land-summer-trees-z1 | PASS | Isolated cut stumps, low fern/shrub stages and small leafy trees are visible on cleared grass among independent ambient trees. No obvious square image backgrounds or cut-off crowns. Manor is partly outside right viewport. |
| prepared-land-summer-trees-z06 | PASS + NOTE | Same isolated stage placements fit in wider river/forest context; pale stump heads remain clear, adjacent low green stages are less distinguishable from ambient decoration. |
| prepared-land-winter-trees-z1 | PASS + NOTE | Snow-tipped cut stumps, brown low shrub stages and bare young trees visible. Fine branches are low contrast against winter ground; no new placement shift observed. |
| prepared-land-winter-trees-z06 | PASS + NOTE | Winter stage placements retained; bright stump tops easiest to identify. Small brown regrowth/saplings blend with background decoration, so stage recognition is limited. |
| prepared-land-summer-fallow-z1 | PASS + NOTE | Tilled patch upper-center and sapling lower-center visible. Scrub left-center partly behind large ambient tree; grassy abandoned plot right-center partly hidden by fence, marker ring and warning/water icons. |
| prepared-land-summer-fallow-z06 | PASS + NOTE | All four fixture locations remain within view, but grass/scrub details shrink and ambient-tree/plot-marker occlusion remains. Blank manor near upper-center. |
| prepared-land-winter-fallow-z1 | PASS + NOTE | Snow-edged furrow patch and bare young-tree patch visible; plot snow and warning ring obscure underlying fallow surface. Ambient bare tree intersects view of scrub patch. |
| prepared-land-winter-fallow-z06 | PASS + NOTE | Snow patch and plot marker dominate small fallow representations. Low-stage details are hard to distinguish from scattered winter ground decoration. |
| prepared-land-summer-paths-z1 | PASS + NOTE | Two diagonal straight runs, corner bends and branching junctions visible as thin ochre lines. Apparent endpoints correspond to isolated authored samples; no new separation at visible joins. Left sample partly crosses ambient tree/ground patch. |
| prepared-land-summer-paths-z06 | PASS + NOTE | Same diagonal, corner and branch silhouettes persist in wider forest-edge view. Lines are fine/low contrast; cannot identify every port or tiny dot from this context scale. |
| prepared-land-winter-paths-z1 | PASS + NOTE | Winter textured diagonal runs and branching joins readable on pale ground. Snow/decor overlaps parts of right-hand corner and surrounding samples. No new visible join gap. |
| prepared-land-winter-paths-z06 | PASS + NOTE | Same path network silhouettes persist; fine connector details blend with winter texture. Isolated samples do not demonstrate a naturally evolved road network. |
| prepared-houses-1350-summer-gallery-z1 | PASS + NOTE | Twenty deliberately spaced fenced house plots form a diagonal gallery, from low thatch to taller timber bodies. Red/yellow/water markers and three large rings cover parts of roofs/facades; uppermost marker partly under pause HUD. |
| prepared-houses-1350-summer-gallery-z06 | PASS + NOTE | Whole gallery plus river/forest/manor visible. Small house bodies remain distinguishable as silhouettes, but clustered numeric warning badges cover some detail. Blank manor pre-existing. |
| prepared-houses-1350-winter-gallery-z1 | PASS + NOTE | Snow rests on house roofs and plot borders at matching house positions; no new detached snow or body displacement. Warning/ring occlusion remains. |
| prepared-houses-1350-winter-gallery-z06 | PASS + NOTE | Snow coverage readable at gallery scale; individual roof edges/details reduced and clustered badges remain. Full twenty-plot arrangement visible. |
| prepared-houses-1400-summer-gallery-z1 | PASS + NOTE | Same gallery camera, with differing later-year low/mid/tall body silhouettes from 1350. Bodies remain inside plot arrangement; icons/rings obscure parts. This is prepared selection coverage, not natural growth proof. |
| prepared-houses-1400-summer-gallery-z06 | PASS + NOTE | Later-year body variety remains visible in wider context, with small-detail and badge occlusion limits. Manor primitive remains at upper-left. |
| prepared-houses-1400-winter-gallery-z1 | PASS + NOTE | Later-year houses have visible snow roof/yard treatment and retained alignment. No new clipping or floating snow observed; ring and warning overlap retained. |
| prepared-houses-1400-winter-gallery-z06 | PASS + NOTE | Complete compact later-year winter gallery visible; snow and taller roof silhouettes readable, small A/B distinctions not independently identifiable by image alone. |

## Pre-existing findings and claim boundaries

1. **참 — existing manor placeholder:** white wall faces with a flat brown/white roof, labelled 영주관, are conspicuous in baseline and core. This core migration did not introduce or fix that procedural manor. Do not confuse this with the separately authored RenderA manor-six work.
2. **참 — partial occlusion:** fallow scrub and grass samples have ambient-tree/fence/UI overlap; house warnings, water drops, clustered badges and rings cover parts of bodies; the pause HUD overlaps the topmost gallery marker. Draw-lineage coverage is not proof that every source pixel is visible.
3. **참 — readability limit at 0.6:** low winter regrowth/fallow stages and path connectors are much harder to identify than at 1.0. Preservation passes; standalone gameplay readability of every stage is not established.
4. **오탐 as a migration regression — regular rows / gallery arrangement:** regular forest bands and isolated path samples already exist in the baseline. House rows are deliberately authored fixtures. They are not evidence that gameplay naturally produces these arrangements, nor a regression caused by the registry migration.
5. **불확실 / not established here:** individual asset IDs from appearance alone, hidden crop pixels, every path mask, all possible settlements/ages, dynamic growth transitions, other DPRs, physical-GPU/browser behavior, and uncaptured camera positions. Requests/decodes/draw lineage support explicit per-view expected URLs; they do not remove occlusion limits.

Eight forest context scenes and twenty prepared fixture scenes together show runtime context. Prepared population-zero land boards and population-40 house galleries exercise saved render facts; their 1350/1400 labels do not by themselves demonstrate engine-grown upgrades. Winter/summer variants are checked as their own baseline/core pairs, not compared across seasons as though saved facts were identical.

Final scope: visual-preservation gate passes for these 28 pairs with exact RGBA evidence and 56 individual context-image inspections. New Wave20 house-data installation and trade-world installation are separate gates; this report does not approve their as-yet-different output.
