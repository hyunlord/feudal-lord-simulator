# 038 answer presentation mismatch — bounded source explanation

Observed evidence: `.remote-runs/render-EB-old-history-1bab7af/eb-old-history/results.json`, case `ck_evt_038-answer`. Expected presentation SHA256 `2286bfae80a7d7f563fa17eb5270d717dfad7c681c236b66109c867a7bb36e0a`; initial and final actual SHA256 `d3374dda962f17a9fcecce7ab80798560d85f9adae67f9009bf2c28027f497ac`. Both diagnostics contain exactly `/seen`: missing → object with one own property; differingPaths=1, truncated=false, serializationOnly=false. **Object size 1 does not establish one mark or any specific story key.**

Independently gunzipped actual input `.omo/evidence/weight125-kept-partial/checkpoints/ck_evt_038-answer-h-002358.save.json.gz`: tick 36037, `Object.hasOwn(state,'seen') === false`. No input edit. Initial/final history+trace exact=true, tick unchanged=36037, presentationUnchangedDuringCapture=true, errors=[]. Thus the observed addition was already present at the first post-openScene sample, and did not change during the subsequent recorded capture/navigation interval. It is not whole-state identity with the input.

## Source path capable of producing exactly this addition

- `src/engine/engine.types.ts:205` defines optional GameState.seen.
- `src/state/gameStore.ts:167` routes `mark_story_seen` to `markStorySeen`.
- `src/engine/storySeen.ts:40–51` validates the id/how, creates or updates a mark at the **current** tick, and returns `{ ...state, seen: { marks } }`. This changes neither tick nor history/trace. It initializes missing seen on first valid mark; its one own property is marks. It is saved UI presentation acknowledgement, not a decision or ledger posting.
- Exhaustive source search for `mark_story_seen` / `markStorySeen(` found the production UI dispatcher in `src/ui/hud/useStoryPresentation.ts:100`: `markOpened(id)` dispatches how=opened. Load-time reachable callers include house modal acknowledgement (:166–169), slice opening/end acknowledgement (:175–184), automatic house opening (:188–190), and annual review opening (:209 onward). Their conditions differ; this diagnostic did not log which branch ran.
- `scripts/renderCommitProbe.mjs:63–97` openScene loads the app, waits for the proof port, dismisses welcome if present, presses Escape (again if pause menu appears), then waits 1500ms. `run:false` skips the speed/run click; it does **not** disable normal React presentation effects or acknowledgement dispatches. `useStoryPresentation.ts:130–136` explicitly schedules presentation wake-up even while the game is paused. Consequently a UI acknowledgement can occur before capture's initial state sample without any simulation tick.
- `src/render/presentation/residentWalkerState.ts:9` is the expected presentation transform; it is not the seen initializer. `src/save/migrations/v50ToV51.ts:5–10` only changes envelope version and does not add seen. The capture loader separately requires decodeSave state equality with the encoded input.

## Conclusion and boundary

The sole difference is consistent with normal UI boot marking a story opened through the existing `mark_story_seen` path. Source explains how missing seen becomes `{marks:...}` without changing game history, trace, or tick. It does **not** identify the unrecorded id, mark count, exact modal, or exact dispatch timing. Do not label this a raw-save corruption, a simulation divergence, or an exact presentation-state pass. Keep the initial/final mismatch visible alongside the narrower unchanged tick/history/trace and capture-interval identity results.

If exact attribution is later required, record a compact initial/final seen mark summary (id/tick/opened/dismissed) or dispatch evidence during normal boot; no need to suppress UI behavior or modify the checkpoint to make hashes match. This review performed no browser/remote jobs or source changes.
