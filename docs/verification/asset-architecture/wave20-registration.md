# Wave20 complete32 draft registration

Preparation only; **no runtime installation, catalog change, ledger edit or runtime capture**. Owned artifacts: wave20-bundle.json, wave20-install-plan.csv and this report. Exact32 approved rows from original-install-inventory.csv, group wave20-era. Draft ArtBundle contains32 new images plus4 reused existing runtime images, validates against current shared schema/registry and selects all36 entries in a static context matrix; this is not a game draw proof.

## Sources and hashes

20 bodies: original candidates L0/L1 v1 eight, rework L2/L3/L4 v2 twelve. Six boarded-v3 from rework. Six roof_snow-v4 from snow-v4 batch. Never use upper-level bodyv1 or shared snowv3. All32 PNG headers/dimensions and SHA256 checked against original inventory. PNG chunks inspected: none contain caBX/jumb/c2pa; proposed runtimeSha256 equals sourceSha256. Actual32 target copies still need installation verification later. Exact source/target/hash/dimension mapping is wave20-install-plan.csv; no shortened hashes.

## Calibrated scale and native geometry

`assets-inbox/wave20/candidates-20260926/records/REFERENCE_CONTRACT.md` defines each native pivot and scale from approved historical-house registration. Current `src/render/historicalHouseAssetManifest.generated.ts` still matches its1254 source canvas and alpha bounds. Current `historicalHouseAssets.ts:77-81` uses world width64×0.88=56.32 and tile front point at screen center+(0,16).

For native width N and original alpha rectangle (x,y,w,h):

- pivotX=(x+w/2)×N/1254; pivotY=(y+h)×N/1254.
- scaleWorldPerNativePixel=56.32/(w×N/1254).
- Draw full native canvas at frontPoint−nativePivot×scale. Do not recrop or refit from new alpha extent; the new upper-storey silhouette/chimney intentionally exceeds the old crop.

| Level | Native canvas | Pivot x,y (body CSV) | Uniform world scale |
|---|---|---|---|
|0|153×153|77.35406698564593,139.57894736842104|0.4995704948646125|
|1|139×139|71.66148325358851,125.92025518341308|0.4986217267599071|
|2|137×137|70.95813397129186,132.08373205741626|0.4980801861842801|
|3|142×142|74.39712918660287,138.03668261562999|0.4983578424454543|
|4|161×161|81.97647527910686,157.40510366826157|0.4979186553958305|

All footprints1×1, full crop(0,0,W,H), allowMirror=false. Body metadata owns exact floating values; overlays inherit those exact values rather than retaining inconsequential last-bit decimal differences in older CSV serializations. No independent axis scale or overlay fit. Geometry equivalence alone did **not** decide compatibility; target IDs below have explicit source proof.

## A/B overlay compatibility evidence

**Boarded12 target combinations:** rework `records/overlay_compatibility.csv` explicitly names each L2–4×1350/1400×A/B body SHA and selected boarded-v3 SHA. All12 rows match the actual approved body/overlay hashes, say compatible, offset(0,0), and record zero positive-alpha pixels outside body. Rework README says boards are constrained to the shared A/B body alpha. Each of6 boarded entries therefore targets **only its two exact era/level A/B body IDs**. No unrelated or base1300 body is permitted.

**Snow12 target combinations:** snow-v4 `records/assets.csv` declares variants=a;b for each of6 era/level snow images. Its `records/roof_coverage.csv` lists all12 exact body filenames, measured65.75–77.24% roof coverage, pass=true. README explicitly says each file is shared by corresponding era/level a/b, same canvas/pivot offset(0,0), scale1. The body CSV source hashes are verified against actual approved files. Each snow entry targets only that era/level's two body IDs. The native-source composite `records/provenance/1400/composite_l4_b.png` was visually inspected: snow stays on the pitched roof while retaining clear chimney opening and exposed roof patches. This individual inspection supplements the source evidence; it is not a fresh all12 visual audit.

Historical roof masks use hand-traced ±2native-pixel boundaries and exclude canopy, gable walls and chimney. Off-roof alpha is small but not universally zero (max recorded28.76 alpha-area pixels). Do not relabel historical QA as new runtime QA.

## Rule/consumer contract

- Bundle `wave20-era`:36 entries,26 rules (10 body era/level selectors,6 new boarded,6 new snow,4 reused legacy layer rules). The new-install count remains32.
- Body slot house-body, priority100. Conditions buildingKind=house,level0–4,calendarYear[1350,1400) or[1400,∞),lot=single,eligible=true. Two A/B variants weight1 each. Year<1350 returns no override. Actual consumer eligibility independently excludes fire/burnt/alehouse/pairs.
- Child consumer ownership `/root/contract_types_executor` confirmed deterministic seed from `textRandom(state.seed,building.id,0)` scaled/floored to32-bit, body anchor center+(0,16), effective blended season names.
- Layers slots house-boarded / house-snow. Conditions exact allowed bodyId pair, layer name, vacant=true for boards or season=winter for snow. vacant means existing `housePressureStatus==='abandoned'`, not arbitrary residents=0. Board order10, snow order20. Adapter inherits body geometry, neither layer is fitted independently.
- Body plus required layer loading is atomic for display: until selected layers ready, legacy fallback is required; absence/missing are not equivalent to ready.

## L0/L1 reused overlays: obligation closed statically

The eight L0/L1 bodies preserve original geometry and reference existing legacy boarded_l0/l1-v2 and roof_snow_l0/l1-v2. Four existing files are now included as reused layer registrations, **not new installation rows**. IDs are wave20/reused-boarded_l0-v2, wave20/reused-boarded_l1-v2, wave20/reused-roof_snow_l0-v2 and wave20/reused-roof_snow_l1-v2. Existing URLs remain under assets/wave7/overlay/ or assets/wave7/season/; no PNG copying/resizing proposed for these4.

`docs/provenance/assets.csv` provides exact canonical inbox paths under wave7/rework-v1/assets/ and runtime hashes. All4 source bytes and existing runtime bytes match both recorded SHA values. Native dimensions153×153 forL0 and139×139 forL1 match body registration. Rework overlay_compatibility.csv has16 exact body/layer combinations (2levels×2eras×A/B×2layers), with corresponding body SHA, selected overlay SHA, compatible verdict and offset0,0. Each reused entry targets only its four documented same-level era/A/B body IDs and inherits their exact pivot/scale/full crop. These are evidence-backed compatibility links, not merely dimension matches.

Install-plan CSV has36 rows with explicit action and counts_as_new:32 install_new/true,4 reuse_existing_runtime_registration/false. New rows remain installed_now=false; reused rows installed_now=true describes independently byte-verified pre-existing runtime files. Runtime acceptance still needs seasonal/vacant scenes and atomic readiness fallback.

## Validation performed (Mac)

- Direct source SHA and PNG dimensions32/32; metadata chunk scan32/32 no C2PA removal required.
- Exact boarded source/body SHA compatibility12/12; historical snow coverage matching12/12.
- Shared validateArtSchema + validateRegistryData initially32entries/22rules,0issues; final createArtRegistry validates36entries/26rules including reused overlays.
- createArtRegistry: succeeds. Final static selector matrix reaches36 distinct entries (32new+4reused), all20 body variants with both layer choices (40body/layer combinations). Prior1349/1399 boundary check passes.
- No runtime files written. No new production TS changed by this lane. Runtime pixel parity, mixed-season neighborhood ordering, visible natural-state occurrence, missing image/network behavior, legacy low-level runtime layer appearance and actual camera/DPR remain parent verification obligations.

Data-only proof boundary: commit/freeze the generic consumer first. Then source copies + exact provenance/ledger + bundle/catalog data may be installed without product TS changes. Compare that later diff to the core-adapter commit, not to the start of implementation. This draft is not yet that proof.

Graft navigation savings this preparation:19,068 estimated tokens. Current source and package records verified independently.
