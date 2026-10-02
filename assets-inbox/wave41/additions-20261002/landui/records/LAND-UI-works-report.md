# LAND-UI works report (Wave 34 fords and drainage, the drain tool, MA-10 copy)

Worktree /Users/rexxa/github/fls-landui-works, branch claude/landui-works. It is based on 781b9ec7 and has 4 local commits; nothing is pushed:
- e4172a89: the main change.
- 715c485f: the drain card moves to the trade drawer; the evidence scripts are added.
- 7ff4c392: diagnostics in the capture script.
- fd1dfd9a: the evidence.

Engine files are unchanged (0 lines).

## What changed

### 1. Wave 34 install
`scripts/installWave34.py` installs the 28 confirmed files into `public/assets/wave34/{ford,drain,props}` (1.5 MB):
- 26 from candidates-20260929, minus the 2 superseded stage-3 v1 tiles.
- The 4 v3 region sheets from stage3-regions-20260929.

How it installs them:
- It drops the `-vN` suffix.
- It asserts that no file has a C2PA chunk, and that each sha matches the CSV and the ledger.
- It writes 28 `docs/provenance/assets.csv` rows and 28 prompt files `docs/provenance/prompts/<name>-wave34.txt`.
- It sets `installed_by = LAND-UI` on those 28 ledger rows only.
- It generates `src/render/wave34WorksManifest.generated.ts`, with url, folder, stage, season, repeat (none / x / grid / region), size and pivot for each file.

The manifest is added to the provenance enumeration (`scripts/provenanceLedgerAssets.ts`, one line). `verify:provenance` reports no missing rows, no orphans and no hash mismatches.

Loading: the art loads on first draw through `manifestArt` (`src/render/wave34Art.ts`). It is not in the startup preload, and a test checks that.

### 2. Fords (LU-D3, LU-D4)
Code: `src/render/landWorksModel.ts`.

**Grouping.** `fordGroups(state)` joins the `RiverData.fords` cells that touch on a side.
- Axis: a two-cell group takes the axis its cells spread along (cells side by side in x give `nw`, in y give `ne`). A single cell takes its flow (e/w gives `ne`, n/s gives `nw`).
- I use the shape for two-cell groups because the first cell's flow letter is often a bend's letter and disagrees with the crossing.
- Width is the number of cells. A width-1 group uses the w2 sheet centred on its cell (LU-D4).
- A group draws only if one of its cells is a road ford (`isFordRoad`).

**No bridge on a ford road.** `bridgeDeckAt(state, tile)` returns null on ford roads. It is used by:
- the deck (`drawBridges.ts` `drawBridgeDeck`);
- the rails (`bridgeRailPieces`, and the walker test at `drawObjectRenderItems.ts:85`);
- the shoreline's bridge spans and lock (`groundSceneParts.ts` `bridgeSpans`).

**Splash.** `drawFordSplash` adds one line in `drawObjectRenderItems.ts`, just before each walker is drawn. It runs only when the walker stands on a road ford cell, and alternates splash a/b every 240 ms. `drawObjectRenderItems.ts` is now at 205 pure LOC.

### 3. Drainage (LU-D5)
`src/render/landWorksDraw.ts` exports `drawLandWorksInChunk`. Per work, by `workDone / workNeeded`:
- **Stage 1:** the stake tile on each perimeter cell. Cells whose open side faces ±x keep the tile as painted; cells whose open side faces ±y take it mirrored; corners take both.
- **Stage 2:** the ditch tile, mirrored, on two rows along tx (rows minTy+1 and maxTy−1; a single middle row when the box is 3 rows or fewer), plus the sluice at the +tx end of the first row.
  - Stages 1 and 2 are composited at source size on one canvas per work, then drawn once at 0.5.
  - That composite cache keeps 4 entries at most, and its key is listed in a comment.
- **Stage 3:** the region sheet, 3x3 when the box is at most 3x3, else 5x5. It is pivoted on the box centre and clipped to the union of the work's cell diamonds.
- **Men digging:** while `diggers > 0`, the earth cart and the soil heap stand on the bank grass cell nearest the box's front corner.
- **Drained cells:** a `drain_done_edge` strip on every outer edge of the drained set, sheared like the Wave 28 strips (64 source px per edge), plus one plank bridge per drained patch.

Season (LU-D1): winter uses the winter files; spring, summer and autumn use summer.

### 4. The hook in drawTerrainBoundaryV2.ts
Three lines, exactly:
- `:33` — the import of `drawLandWorksInChunk` and `landWorksChunkToken`.
- `:127` — the end of the `groundReadiness` expression gets `+ landWorksChunkToken(input.state, plan)`. This is the chunk key change.
- `:206` — `drawLandWorksInChunk(context, input.state, plan, season);` right after the `drawIceRim` line.

`landWorksChunkToken` is in `landWorksIndex.ts` and re-exported from `landWorksDraw.ts`.
- **Value:** `""` for a chunk that no ford, work or drained edge reaches. So every riverside chunk key and every unaffected chunk key is unchanged; a test checks all 64 riverside chunks.
- **Otherwise:** `:lw<1 if the chunk's Wave 34 art in both seasons has loaded>` plus the chunk's works signature. The signature holds each road ford group as `f<first cell><axis>`, each work as `w<id>.<stage>` plus `d` while men dig, and `e<drained count>` when drained edges reach the chunk.
- **When the key changes:** on a stage change, when digging starts or stops, when a patch finishes, and when the art finishes loading. Progress within a stage keeps the key; a test checks this.
- **Seasons:** both seasons' readiness is in the token, so a staged next-season raster is keyed correctly.
- **Cost:** the index is memoised on the identity of (tiles, river, drainage), and the per-chunk lists are filled on first ask.

### 5. Drain tool (LU-D6)
**Card.** `BuildMenu.tsx` adds a fen-only card (`drainToolAvailable` reads `stateArchetype(state).terrain.kind === "fen"`) in the **trade (생업)** category, beside the arable brush.
- I first put it in the paths category. That does not work: pressing the paths category arms the road tool, which closes the drawer, so the card can never be reached. That is why it moved.
- The card is a kit `Button` and uses `build-tool` classes, so it needs no registry row.

**App.tsx.** Three edits, outside the lands agent's ranges:
- `drainTool` state at :131.
- `selectPlacementTool` clears the drain tool; `selectDrainTool` clears the other tools; an effect clears the drain tool when a zone brush or a wall draft appears.
- The tool sends `pick_tool`, so the drawer closes. Leaving placement mode (Esc) clears it.

JSX: `drainTool` and `onDrainToolChange` are passed to `GameCanvas` and `BuildSeals`.

**Canvas runtime** (`src/render/canvasDrainRuntime.ts`):
- `drainSelect`: a click sends `{type:"drain_fen",tx,ty}`, or shows the refusal as placement-failure feedback.
- `drainCancel`: a right click disarms the tool.
- `drawDrainPreview`: draws the plan's cells as placement-fine tiles, or hatches the hovered tile on a refusal.

**Wiring:**
- `useGameCanvasRuntime`: refs, the armed tool counted as a tool, the handler's dependencies.
- `canvasIntentHandler`: the select and cancel cases.
- `canvasRuntimeFrame`: publishes the chip lines through the existing PredictionPanel, the same way the zone brush does, so there is no new surface.
- `gameCanvasFrame`: draws the overlay after `renderFrame`.

renderer.ts is untouched. GameCanvas.tsx is at 215 pure LOC, useGameCanvasRuntime at 135.

Model and copy: `src/ui/drainToolModel.ts` and `src/ui/drainageCopy.ko.ts`. The chip shows cells, timber and seasons, and has a Korean line for each of the six refusals.

### 6. MA-10 and road copy
**Refusal by need.** New `src/render/adjacentTerrainNeed.ts`. `needs_adjacent_terrain` now names what the building needs:
- fulling mill: "흐르는 물가 옆에 지어야 합니다 — 강이나 개울"
- dyehouse: "물가 옆…"
- quarry: "바위 옆…" (the quarry said "숲 옆" before, which was wrong; I fixed it while there)
- everything else: "숲 옆…"

Where it applies:
- Feedback: `placementFeedback.ts`, with the map in `placementFeedbackCopy.ko.ts` (`needsAdjacent`; the old `needsForest` key had no other user and is removed).
- Chip reasons: `placementChipCopy.ko.ts`.
- Tile marks: `placementTileMarks.ts` gets new reasons `needs_water`, `needs_flowing_water` and `needs_rock`. Their icons in `placementTileOverlay.ts` are cause/water and resource/stone. The fulling mill's ring now counts only flowing water as contact.
- Building card: `buildingCatalog.ko.ts` changes to "흐르는 물가에만".

**Roads.**
- Road prediction: ford cells are now a `ford` segment kind, drawn in water blue without planks. The cost line uses `previewCostWithFords` in `roadPlacementCopy.ko.ts` when the path has fords; otherwise the old text is unchanged.
- Road card: "육지 무료 · 다리 목재 4/칸 · 여울 목재 1/칸", from `buildMenuCopy.ko.ts` `roadCost`. `tests/buildMenuContracts.test.ts:206` is updated to the new string. The old literal in `buildMenuPresentation.ts` is now a stale Korean-baseline entry, which the check reports only as a note.

## Checks run (on the Mac, single files)
- `npx tsc --noEmit -p .`: clean.
- The project eslint (`tools/eslint`, `--max-warnings 0`) on all 33 touched source files: clean.
- New `tests/landWorks.test.ts`: 10/10 pass. It covers:
  - ford grouping, axis and width on coast, downs and forest seeds 1–3, and none on the riverside or the fen;
  - ford roads have no deck, rails or span, plus the chunk tokens and the water cells;
  - the road prediction counts fords;
  - stage thresholds, region sheet choice, perimeter stakes, ditch rows and clipping cells;
  - drained edges, the plank bridge, and the token by stage and digging;
  - the chip's lines and every refusal (not_fen, not_still_water, no_bank, busy, too_many_works, insufficient_timber);
  - the drain clicks: command, failure feedback and right-click disarm;
  - App tool clearing (source checks);
  - the MA-10 messages and marks per kind;
  - the install.
- Existing tests, all passing:
  - bridges, buildMenuContracts, buildMenuCategoryIntent, canvasContextMenuResolution, canvasRuntime, canvasRuntimeRefs
  - gameCanvasEventBoundary, gameCanvasRuntimeInput, hoverOnlyInfo, inputIntentBoundary, inputIntents, onboardingUi
  - palisadeDrawIntent, phase13Part7BuildMenuProofChrome, placementFeedback, placementPrediction, placementPreviewEmphasis
  - placementLedgerChip, placementStatusTruth, placementTileMarks, renderSourceGuards, shoreline, surfacesRegistry
  - timberTradeAndFords, touchTargets, boundaryLayer, boundaryRender, buildingGrounds, courtConsoleContracts, economyUi
  - eraConsoleModel, fieldStrips, farmsteadArt, frameTokens, groundSceneIncremental, install4eArt, nat2SlotChips
  - padGlyphs, palisadeMenuHint, phase11PublishedUi, phase14Part2Occlusion, phase13Part6Rendering, placementDragCoalescing
  - renderScale, renderStageProbe, roadRibbon, touchGamepadInput, wallFaces, wallStripsFlag, waterMotion, zoneBrush
- `npm run check:merge`: every step passes (pins, ledger, surfaces, eslint, typecheck, korean strings with 0 new, lint exceptions with 0 new, dist budget 83.5 / 150 MB) except ui-geometry. That one fails only because the UI inputs changed since the committed result, which is expected; the lead runs the geometry audit.
- The full suite and the perf gate were not run (DGX / lead).

## Evidence
`docs/verification/landui/works/`, 9 JPEGs, 460 KB in total. DGX captures from run render-LANDUI-works-7ff4c39 (clean tree at 7ff4c392), at 1280x800 cropped to 960x600:
- `coast-ford-summer.jpg` and `coast-ford-winter.jpg`: a road across the coast's two-cell ford. Stepping stones and banks are drawn; no deck or rails.
- `downs-ford1-summer.jpg` and `downs-ford1-detail.jpg`: a single-cell ford with the w2 sheet (see the open issues).
- `fen-works-a-summer.jpg` and `fen-works-a-winter.jpg`: one work at stage 1 with men digging (stakes, cart, heap), one at stage 3 (the 5x5 region clipped to the cells), and a finished patch (edge strip and plank bridge).
- `fen-works-b-summer.jpg`: the first work at stage 2 (ditches and sluice).
- `fen-tool-chip-mere.jpg`: the drain card armed, hovering a mere. The chip reads "배수 공사 · 메울 물 10칸 / 목재 50 / 일꾼 4명이면 약 1계절 / 클릭하여 공사 시작…", with the plan's cells lit.
- `fen-tool-chip-refusal.jpg`: hovering grass, then clicking. The tile is hatched, the chip shows the not_still_water refusal, and the failure toast shows below it.
- `result.json`: the chip texts and the Wave 34 pictures loaded per scene.

To reproduce:
1. Make the states with `npx tsx scripts/landWorksStates.ts <dir>`. They are save envelopes plus `tiles.json`.
2. Run `scripts/remote/run.sh <label> -- bash -c 'node_modules/.bin/tsx scripts/landWorksCaptures.ts docs/verification/landui/works --states <dir on DGX> --port $FLS_REMOTE_PORT'`. The script starts its own no-watch vite.

The states are on the DGX in `~/fls-landui-works-states`. All my run folders on the DGX are deleted.

## Open issues and decisions to confirm
- **Width-1 fords look weak (LU-D4).** The w2 sheet's water section spans two cells, so on a one-cell brook most of the sheet, ramps and nearer stones included, falls under the bank ground and the road chunk's ribbons, which are drawn after the ground chunks. Only a few faint stones show (`downs-ford1-detail.jpg`). Two-cell fords look right.
  - I first took this for a bug and checked it in the page: the draw happens and the token is correct (`:lw1f1388ne`). It is the geometry.
  - **Astra handoff:** a w1 sheet (`ford_w1_{ne,nw}_{summer,winter}`, a water section of one cell) would fix it. Scaling the w2 sheet is advised against in the records.
- **Wave 29 water motion over fords and stage-3 mud** (records/README asks for a mask). This belongs to the water agent. I exported `landWorksWaterCells(state)` (road ford cells plus stage-3 work cells, memoised) and sent landui-water a message asking them to skip the motion on those cells. Until they do, the ripples and flow run over the stones and the mud.
- **Drained cells read as meadow (LU-D5).** The ground agent's land layer must not give `state.drainage.drained` cells the fen fill. I messaged landui-ground, and also listed my three hook lines so the merge keeps them.
- **Where the drain card sits.** It is in the trade drawer (see section 5). The lead may prefer another place until lord mode's command pins.
- **The splash is not in the evidence.** The state parks a walker on the coast ford, but no walker shows there in the paused capture. The splash code is covered only by the type check and the walker-path code review.
- **Two smaller choices of mine:**
  - The tool stays armed after a successful drain command, so the second works can be placed; it disarms on Esc or a right click.
  - The insufficient-timber refusal names no amount, because `drainagePlan` does not return the cells when it refuses.

## Engine handoffs
- **Store the work's origin.** `DrainageWork` has no origin (tx, ty); it is only encoded in `id`. The render centres the region sheet on the cells' bounding box instead. Please add `origin: {tx, ty}` to `DrainageWork` in `startDrainage`. Then the 5x5 sheet can centre on the chosen tile, which always covers the plan.
- **Return what a refusal would need.** `drainagePlan` refusals could carry the needed timber (cells × 5) for `insufficient_timber`, so the chip can say how much is short.
