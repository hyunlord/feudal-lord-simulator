# Priority simulation independent code review

Scope: current service allocation, shared UI diagnosis, tick labour timing, autoplay water demand, and runtime sprite/wall raster caches in `../feudal-lord-simulator-playable`. Existing dirty art, wall geometry, forestry and unrelated engine changes are not attributed to this task.

## Finding requiring correction

P1: `population/serviceAllocation.ts` initially assigned in house-ID order, choosing the closest provider. This stranded constrained households while another usable provider remained empty.

Concrete local execution: wells a(5,5), b(10,5); flexible homes h00-h11 at x=6/7,y=3..7 plus (5,4),(5,6); constrained h12(0,5). Results: a.used=12, b.used=0, h12.water.kind=capacity. All lots and providers have distinct positions. The 12 flexible homes can use either well; h12 can use only a. Sent to implementation owner and leader; correction pending review.

## Other inspected behavior

- Service demand uses `houseLotArea`, so merged residences count as two lots and empty residences reserve their capacity.
- Current labour is allocated before market settlement and housing. New arrivals are intentionally available for work next tick.
- Housing, provider inspector, and detailed service UI derive from the same allocation function, not independently guessed radii.
- Road requirements retain wall-aware road connectivity. Wells deliberately remain self-service without staffing or roads, preserving bootstrap growth.
- GameState-keyed derived cache uses weak ownership; immutable reducer/tick transitions invalidate it. Mutating a previously queried state in place is outside this contract.
- Raster cache is bounded at 8M pixels per rendering context, includes transform/viewport/content/asset statuses, and is replayed at each original segment's queue position. It does not flatten all walls into a global foreground layer.
- Actor frame and facility thumbnails are finite manifest-owned buffers; failures fall back to original images and resolve preload.

## Executed checks

`node --import tsx --test tests/serviceDiagnosis.test.ts tests/worldRasterCache.test.ts tests/worldSpriteRaster.test.ts`: 5 passed, 0 failed.

This is a code review, not a claim of complete browser visual or performance verification. Final verdict awaits allocation correction.

## Final re-review: PASS with bounded allocation policy

Implementation now prioritizes households with the fewest reachable providers, then indivisible two-lot demand, then stable house ID. The exact reproduced single-home counterexample and a vertical merged-home variant are regression tests and pass. This removes the reported exclusive-provider starvation. The algorithm remains a deterministic allocation heuristic, not a global maximum-flow/matching solver; do not describe it as guaranteeing optimal coverage under every overlapping network.

Independent final command:

`node --import tsx --test tests/serviceAllocation.test.ts tests/serviceDiagnosis.test.ts tests/autoplayWater.test.ts tests/worldRasterCache.test.ts tests/worldSpriteRaster.test.ts`

Observed 10 tests passed, 0 failed. (The named autoplay file added no separately reported subtests in this run; broader advisor testing remains leader/implementation evidence.)

No further blocking issue found in reviewed scope. Renderer owner reports 36 browser composition cases with exact cold/hot identity; direct versus buffered rendering has small antialiasing differences, so byte-identical old/new pixels are not claimed. Cache pixel budget covers retained raster canvases, not total browser/GPU allocation or temporary peak allocation. Wells still abstract access by distance; church and market require staffed, reachable providers. Labour priorities remain fixed, not a newly implemented player policy UI.
