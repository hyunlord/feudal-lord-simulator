# Integrated scope review

Verdict: **PASS for bounded static integration/scope review; merged-head runtime remains separate.** No actionable merge regression found. Reviewed HEAD `e370716d8f1d33a2ce4c402526953922fcb2e120`, trunk `57228cc1`, original basis `d4973e85`, core `d60ababf`, data `541a0811`. Read-only review; only this report written.

## Verified scope and preservation

- Inspected actual `57228cc1..HEAD` render consumer diff and the interacting `d497..57228cc1` world changes. B product changes are confined to `src/render/`; no engine, content, UI, styles or App product edits occur in the B delta. A and B changed-source file intersection is empty.
- Every B `src/` blob at HEAD is exactly the corresponding blob from `541a0811`. Merge introduced no additional B source modification. This is blob comparison, not an assumption from clean conflict resolution.
- `d60ababf..541a0811`: zero product `.ts`/`.tsx` changes. The catalog JSON and assets carry the data extension.
- Ledger compared by unique `(wave,file)` identity: 6,122 rows before and after; exactly 32 Wave20 rows changed, solely `installed_by`. No additions/deletions; all original SHA/status/verdict/replacement fields preserved. Those 32 complete resulting rows equal the original data commit rows.
- Provenance: 2,385 trunk rows become 2,417. No existing record changes or deletion; 32 new Wave20 records. HEAD bytes start with the exact complete trunk CSV bytes. All 32 original data-commit append lines are retained exactly. Thus the provisional conflict-marker repair in `e370716d` preserves both histories, including original formatting/content.
- For each of the 32 added provenance records, independently hashed actual runtime and source files: both hashes equal their declared SHA values and each other (32/32).
- No conflict delimiters in changed text files. `git diff --check 57228cc1..HEAD` passed. No heavy tests, browser, remote calls, builds or git mutation performed.

## Interacting world consumers

1. `src/render/drawBuildings.ts:161` dispatches house bodies to the contract path and all other historical buildings to the existing facility function, carrying a null house receipt for facilities. A’s manor branch at `src/render/historicalFacilityAssets.ts:148` therefore remains live. B does not replace the manor selector, readiness, pivot, or scale.
2. `src/render/art/contractHouseArt.ts:27` restricts contract facts to single-lot houses with eligible engine state. It preselects compatible body/boarded/snow entries before requesting images and returns a receipt for the body actually painted (`:77`). `src/render/buildingOverlays.ts:54` consumes that receipt; non-house facility overlays remain on their own paths. `src/render/art/artAdapters.ts:53` uses the selected body source/target rectangle for its overlay. No shared mutable global scale is introduced between houses and A’s manor/signs.
3. House catalog geometry remains the previously validated level-specific scale (~0.498), with one-tile footprint and registered pivots. A’s `src/render/manorHouseArt.ts:65` derives its separate scale from its two-tile footprint; `src/render/doorSigns.ts:69` uses its separate sign scale. The numeric scales need not equal because their source canvases differ. Neither A source was modified by B.
4. A wraps the existing land-fallow queue with `withDoorSigns` at `src/render/renderObjectFrameCache.ts:51`; `src/render/doorSigns.ts:236` returns the queue unchanged when no signs exist, otherwise merges signs by depth without replacing existing entries. Its draw dispatch is added at `src/render/drawObjectRenderItems.ts:119`, and its sort y-coordinate at `src/render/objectRenderSort.ts:100`. No dropped land/body branch was found by source inspection.
5. A passes state through manor occlusion geometry in `src/render/occlusionModel.ts:71`. B does not modify that function. Source inspection supports isolation, but cannot prove all dense-scene overlap/occlusion pixels.

## Additional integrated runtime evidence recommendation

The old d497-based exact 28-pair core proof and eight data gallery views remain valid for their recorded code basis; no need to rerun the entire old matrix merely because of the merge. There is nevertheless a material **coverage gap**, not an observed code defect: A changes the queue, sign rendering and manor geometry surrounding B houses/fallow. Existing isolated galleries without road signs do not exercise this interaction.

Recommend four merged-head smoke frames of a prepared **lord-mode mixed scene**, summer/winter × zoom 1/0.6, containing eligible new houses, adjacent roads with actual visible Wave37 trade signs, the manor, and nearby fallow/footpaths. Include a boarded house alongside an occupied house, confirm expected URLs/draws, and inspect sign/body/land depth and seasonal layering. At 0.6, condition signs intentionally disappear; use trade signs to retain coverage. Use 1400 or 1350 consistently; the old gallery matrix already covers both eras. This targeted scene adds evidence unavailable from replaying the same eight isolated house galleries. The queued geometry gate is complementary and should not be described as this world-art visual proof unless it captures these objects.

Remaining limits: no claim of fresh merged-head runtime or full regression-suite success from this static review; no all-state occlusion/performance proof. No product remedy is proposed because no material source defect was established.
