# Independent runtime visual review — lane 3

**Verdict: PASS with visibility notes for this prepared gallery comparison.** No obvious introduced base-contact, neighboring-lot overlap, or gross board/snow registration blocker was visible in the eight after captures. This is a human visual assessment of real renderer output, not a claim of natural play, exact subpixel registration, or every future house situation.

I individually opened all eight native `data-v3` PNGs and all eight corresponding `core-v3` PNGs. I did not read another reviewer's verdict. No product edits, tests, browser sessions or remote jobs were performed. Only this report was written.

## Evidence and scene interpretation

The compared files are `output/art-architecture/{core-v3,data-v3}/prepared-houses-{1350,1400}-{summer,winter}-gallery-{z1,z06}.png`. Native captures are1280×800, DPR1; review used the PNGs directly rather than magnifying compressed JPEG previews. Enlarging a preview is not new higher-resolution evidence.

The fixture source `scripts/artContractStates.ts:130–150` establishes the gallery arrangement: level increases along `tx=28+4*level`; the four rows along `ty` are A settled, A abandoned, B settled, B abandoned. At z1 the highest L0 house is A settled; progressing diagonally down-left gives A abandoned, B settled, B abandoned; progressing down-right increases level. Thus the 20 positions per era expose ten body variants in settled/boarded states. Across both eras this covers20 distinct bodies, six distinct new boarded overlays, six distinct new snow overlays and the four reused L0/L1 board/snow layers. Screenshot appearance alone is not a per-entry execution trace; the fixture and capture identities support this attribution.

Capture pass counts, A/A equality and zero request errors are machine evidence supplied by the capture run, not substitutes for the observations below.

## Individual before/after view log

Every row represents two individually opened files, with the suffix shown below appended to both evidence directory prefixes above.

| File suffix | Visual result | Observed comparison |
|---|---|---|
| prepared-houses-1350-summer-gallery-z1.png | PASS / NOTE | All20 placements remain on their fenced plots. New upper bodies have clearer red roofs and dense pale/dark timber façades; abandoned counterparts show dense boarded fronts. No detached boards or foundation floating is obvious. Warning triangles and three gold rings already obscure façade/ground details before replacement. |
| prepared-houses-1350-summer-gallery-z06.png | PASS / NOTE | The same gallery remains separate and grounded at .6. New red roofs remain distinguishable from low-grade ochre roofs, but fine upper façade/board lines merge. Existing warning clusters dominate some tiny houses; no newly introduced neighboring-house overlap is apparent. |
| prepared-houses-1350-winter-gallery-z1.png | PASS | Low-grade reused snow sits on the corresponding low roof planes. New L2/L3/L4 snow follows the changed roof shapes, leaving red edges/patches visible; no obvious translated second roof or snow suspended outside a roof is visible. Boards remain on façades under snow. Existing snowy fences/ground strips continue beyond the house footprint and are not body-layer drift. |
| prepared-houses-1350-winter-gallery-z06.png | PASS / NOTE | Roof snow is a stable white cap on each tiny new body, without a separate floating patch. At this scale white roof detail and warning badges mask fine contact boundaries; exact A/B eave-fit cannot be concluded from these pixels. |
| prepared-houses-1400-summer-gallery-z1.png | PASS / NOTE | New upper-grade façades and roof profiles differ visibly from1350 and the old bodies. Bases remain inside the same plot corners; settled/boarded versions do not shift as a whole. The taller, highly patterned boarded façades are visually busy but no board rectangle floats away from its body. |
| prepared-houses-1400-summer-gallery-z06.png | PASS / NOTE | Overall placement survives downscale. L2/L3/L4 roof shapes remain legible as houses, while glazing/timber/board details are too dense for reliable individual feature identification. This is a readability limitation, not evidence of wrong transform. |
| prepared-houses-1400-winter-gallery-z1.png | PASS / NOTE | Snow follows the era-specific steep/red roofs and remains separate from wall faces. L0/L1 reused snow stays attached. The upper-grade roof caps retain some red roof; no obvious broad wrong-shape legacy snow pasted onto the new upper body is seen. Small chimney/roof-pin intersections are partially occluded, so this does not certify every chimney pixel. |
| prepared-houses-1400-winter-gallery-z06.png | PASS / NOTE | White roofs remain attached to the same plot-local body silhouettes. No introduced whole-body/overlay misalignment is obvious. Fine board and eave alignment remains uncertain at this native scale, especially behind warning pins and clustered count labels. |

## Cross-view findings and attribution

| Finding | Attribution | Assessment |
|---|---|---|
| Fenced plot positions, visible foundation contact and relative separation remain stable for A/B and settled/abandoned instances | Introduced-change check | PASS: no obvious newly floating body, gross sinking, doubled foundation, or new adjacent-lot collision. This is qualitative native-frame review, not measured zero-pixel displacement. |
| Low L0/L1 bodies keep compact ochre roofs; upper bodies change to red roofs and denser era-specific timber work | SOURCE/new displayed art | Visible intended content difference. The capture demonstrates these changed silhouettes in the actual world grid; it does not independently reapprove historical styling or fix adult/door proportions. |
| Upper boarded faces look markedly busier than settled faces | SOURCE/selected state layer | Consistent with the supplied boards being drawn over windows/walls; not classified as a renderer registration defect. At .6 this becomes a dense pattern and is only weakly semantically readable. |
| New six upper snow overlays follow1350/1400 roof families rather than unchanged legacy roof caps | Introduced-change check | PASS at gross roof registration. Neither A/B comparison nor summer/winter comparison shows an obvious offset snow copy. Exact coverage percentages and one-pixel edge accuracy were not measured. |
| Four reused L0/L1 board/snow layers still appear plot-local and body-aligned on changed low-grade bodies | Reused SOURCE / compatibility check | No visible gross mismatch. Fine boards at the small lower windows are less certain than roof registration because native pixels and UI occlusion limit inspection. |
| Large warning triangles, water drops, gold condition rings and low-zoom count badges obscure some roofs/fronts | Pre-existing | Present in before frames. Do not attribute their overlap to the newly registered house bundle. They reduce confidence in small concealed regions. |
| Manor/keep placeholder shape near the top-left of .6 captures | Pre-existing | Same conspicuous simplified shape in before and after; unrelated to Wave20 body replacement. |
| Snowy fence rails and detached ground snow marks around plots | Pre-existing | Already present in before winter frames; not evidence that new roof-snow geometry leaked onto terrain. |
| Dense outlines/timber detail at .6 and very small doors | SOURCE/display-scale limitation | These views cannot establish art-bible17.6px adult/door compliance: no controlled adult comparison is shown. Do not treat this review as HEIGHT-1 approval. |

## Acceptance boundary

This lane accepts the visible **prepared gallery runtime integration** at zoom1/.6 for obvious body contact, overlap and body/state-layer registration defects. It does not establish natural settlement evolution, moving-camera stability, seasonal transition behavior between screenshots, asset-loading transitions, DPR2 behavior, adjacent dense-town occlusion, or unseen poses/situations. It does not claim that machine PASS8/A-A8/errors0 is visual approval.

No new blocking introduced defect was identified in these16 native frames. Remaining low-zoom detail and partially concealed contact points are recorded as NOTE/uncertain rather than silently upgraded to exact geometric proof. Mainline installation remains the parent integration decision.
