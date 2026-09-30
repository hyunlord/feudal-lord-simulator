# Read-only source and fixture review

HEAD 4ad2d2a4. Viewed `/tmp/QA_ROUND_01/evidence/11-1380-paused-settled.jpg` with view_image. Inspected original `fixtures/perf-gate/ch4-1380.save.json.gz` without mutation. No browser, tick execution, or code changes.

## Wall opening

The image shows two differently aligned stone-wall ends around a short ground passage near the supplied region. The source fixture has one explicitly designated gate at tile-edge `(47,42)`. Segment `palisade-000041-segment-000` starts there and segment `...-002` ends there. The full boundary has 19 completed stone segments, 76 unit edges, 76 distinct nodes; EVERY node has degree 2. There is no unconnected endpoint in the original fixture boundary.

The renderer intentionally opens a gate: `src/world/wallTraversal.ts:GATE_HALF_CLEARANCE = 0.8`; `src/render/stoneWallTopology.ts` marks the designated node as `gate`; `src/render/drawWallFaces.ts:drawWallFaceSlice` excludes 0.8 tiles at gate chain ends (lines88–89), and gate art/fallback is handled separately. Consequently an opening at the designated gate is expected, not missing fixture connectivity.

Qualification: exact supplied screen rectangle to gate-node registration is NOT confirmed. The pure initialCamera calculation for original fixture and assumed canvas CSS1600×1100 gives zoom2/panX544/panY−2277 and gate ground anchor `(864,571)`, outside x760..830/y470..545. Actual canvas dimensions/camera or gate artwork extent can differ. Thus: fixture topology defect ruled out for its original boundary; visible opening strongly consistent with the gate but exact pixel identification remains a candidate, not a proved annotation. Do not call it a confirmed missing wall.

## Water crossing

Checked all 76 unit edges against original fixture tile terrain using the exact classification in `src/world/palisadeGeometry.ts:stepCrossesWater` (lines285–298): a diagonal crosses water when its interior tile is water; axis-aligned edge crosses water only when neither adjacent tile is non-water.

Result: **0 water-crossing edges**. **12 edges touch water** on at least one side and are valid shore edges. All19 segments are completed stone. Therefore the fixture's logical wall does not cross water under current placement semantics. The picture's curved water shoreline and wall-strip thickness/curvature are render geometry; perceived overlap cannot be diagnosed from logical tiles alone. This check is fixture geometry evidence, not pixel-level renderer clearance proof.

## Tree sway frequency

`src/render/renderMotion.ts:ambientOffset` = amplitude × sin(tick × frequency + phase). `src/render/drawTrees.ts:drawTreeDescriptor` and fallback `drawTree` use frequency0.72 radians/tick. `drawBuildings.ts` supplies state.tick, not wall-clock time.

Nominal phase frequency at20 ticks/sec: 0.72×20/(2π) = **2.291831 Hz**. At5x (100 ticks/sec): **11.459156 Hz**. Requested arithmetic is correct. These are nominal phase rates; perceived oscillation can differ with frame rate, discrete tick updates, and temporal aliasing. At fixed paused state.tick, this tree sway is fixed; water/reeds, season fades, and chapter story-overlay people have separate clocks.
