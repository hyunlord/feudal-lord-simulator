# Stage 3: The Palisade Age — Design

## Purpose

Stage 3 adds one complete era transition, from `hamlet` to `palisade`. It does
not add later eras, zoning, policies, advisors, raids, or a second progression
system. The transition is a player decision, a deterministic simulation event,
and a visible settlement transformation.

The implementation starts from Stage 2 commit
`3b268dd501014ef9b914eb491e3543a79b30930b`, whose DGX baseline is 549 tests
and determinism hash `5a393f13af3e61be`.

## Settled interpretations

The goal text contains one arithmetic conflict. A wall segment covers four
perimeter tiles, while the example says a 40-tile perimeter costs roughly 600
timber. Stage 3 therefore uses the following explicit rule:

- timber costs 15 per perimeter tile;
- a full four-tile segment costs 60 timber;
- a final partial segment costs `15 * tileCount`;
- every segment, including a partial final segment, requires 120 builder-ticks.

This keeps the 40-tile example at 10 segments and 600 timber. It also preserves
the intended choice between proclaiming as soon as the 250-timber requirement
is met and waiting to bank enough timber for faster wall completion.

Other settled interpretations:

- the 600-tick labour diversion uses simulation `tick`, not presentation
  `wallTick` and not builder-ticks;
- clicking `시대를 선포하다` enters wall adjustment mode; the era changes only
  when the adjusted polygon is confirmed;
- confirmation atomically records the era, polygon, gate, and all construction
  sites;
- wall sites are created together, but only the earliest incomplete segment in
  gate-outward order can receive builders;
- walls do not restrict building placement or road/walker pathfinding;
- the single gate is a visual/protection boundary, not a routing blocker in this
  POC;
- presentation effects never mutate housing or economy logic.

## Architectural approach

Use a first-class palisade variant inside the Stage 2 construction model. Do
not add `palisade_segment` to `BuildingKind`, because building configuration
also controls rectangular footprints, production, storage, service, and
finished-building creation. Do not build a separate instant wall scheduler,
because wall construction must use Stage 2 materials, carters, stalls,
builders, minimum visibility, cancellation safety, and diagnostics.

`ConstructionSite` becomes a discriminated union:

- building sites retain `kind: BuildingKind` and their existing rectangular
  origin;
- wall sites use `kind: "palisade_segment"` and carry an ordered tile-edge path,
  segment index, gate distance, and wall id;
- common material, reservation, builder, stall, and timing fields remain shared;
- every consumer switches exhaustively on the site variant.

Completed wall segments become `PalisadeSegment` records, not `Building`
records. The render queue places proposed, unfinished, and finished wall paths
in the documented overhang seam. The building economy remains unaware of wall
geometry.

No new dependencies are required.

## Era and proclamation domain

Add the canonical types:

```ts
export type Era = "hamlet" | "palisade";

export interface EraRequirement {
  key: "population" | "granary" | "chapel" | "timber";
  label: string;
  current: number;
  target: number;
  met: boolean;
}
```

`GameState` gains:

- `era`, initially `hamlet`;
- `eraProclaimedTick`, initially `null`;
- `palisade`, initially `null`, then the confirmed wall aggregate;
- the existing `wallTick` remains the Stage 2 presentation-time floor and is
  not renamed or reused for era duration.

The four requirements are evaluated independently by a pure function:

- population: `state.population >= 60`;
- granary: at least one finished `granary` building;
- chapel: at least one finished `chapel` building;
- timber: at least 250 uncommitted, physically spendable timber across treasury
  and material storage, using the same reservation-aware accounting as Stage 2
  placement.

The chapel is a normal 1×1 building with cost 40 timber, zero workers, zero
production, zero storage, and normal Stage 2 construction. It does not add a
service radius or a second faith system.

Proclamation is rejected by the reducer unless all four requirements are met,
the candidate polygon validates, and the era is still `hamlet`. Repeated
proclamation actions are idempotently rejected.

## Proposal geometry

Geometry uses integer tile-edge coordinates, distinct from tile-centre
coordinates. The proposal algorithm is pure and deterministic:

1. Expand every finished building footprint to its four tile-edge corners.
2. Compute their convex hull with a monotonic-chain algorithm and stable
   coordinate ordering.
3. Apply a three-tile outward offset.
4. Rasterise the boundary onto an eight-direction tile-edge graph, permitting
   horizontal, vertical, and 45-degree steps only.
5. For any boundary run that would cross a water tile, find the cheapest
   deterministic outward route on the same eight-direction graph. The cost
   favours proximity to the offset hull, never passes through water, and uses
   coordinate ordering as its final tie-break.
6. Simplify consecutive collinear steps while preserving the exact closed path.

The proposal must enclose every existing finished-building footprint. If the
world boundary or water makes a valid closed route impossible, the proposal is
unavailable and the UI reports the concrete reason; proclamation remains
disabled.

The dashed proposal becomes visible when at least one of the four era
requirements is met. Before edit mode, it is derived from the current
settlement and therefore updates when buildings change.

## Adjustment interaction

Pressing the enabled proclamation button snapshots the current proposal into
React/canvas presentation state and enters adjustment mode. It does not yet
change `GameState`.

The player selects a polygon run and drags it along its outward or inward
normal in whole tile steps. Adjacent connectors are rebuilt with eight-direction
steps. Every candidate is checked before it replaces the prior valid edit:

- the path is closed and has no self-intersections;
- all coordinates are in bounds;
- no edge crosses water;
- at least 60 percent of existing finished buildings are fully enclosed;
- the gate candidate exists;
- perimeter length and timber cost are finite and nonzero.

Invalid drags show the reason and leave the last valid polygon unchanged.
Escape cancels edit mode without changing simulation state. The confirmation
surface always displays current perimeter steps, segment count, timber cost,
and expected builder-ticks.

## Gate and segment ordering

Find every road tile crossed by the confirmed polygon. Score each candidate by
the number of occurrences in active non-builder walker paths at confirmation
time. Choose the highest score; ties resolve by distance to settlement centre,
then `ty`, then `tx`. If the polygon crosses no road, choose the boundary point
nearest the highest-traffic road and connect it visually without mutating the
road graph. Exactly one segment is marked as the gate segment.

Convert the closed perimeter steps into consecutive groups of at most four.
Order groups by circular distance from the gate group. Equal clockwise and
counter-clockwise distances resolve clockwise first. Stable ids include the
wall id and zero-padded order, so creation and allocation do not depend on
array insertion accidents.

All sites are created in one reducer transition. Material delivery can reserve
and deliver to any wall site, but builder eligibility is limited to the first
incomplete group in the stable order. `queued` is a wall scheduling state, not
a sixth `ConstructionStall`; once active, every existing Stage 2 stall reason
applies unchanged.

## Labour diversion

For simulation ticks satisfying
`state.tick - eraProclaimedTick < 600`, calculate:

```text
wallQuota = availableWorkers > 0
  ? max(1, floor(availableWorkers * 0.40))
  : 0
```

Reserve this quota before ordinary production allocation. Assign up to the
Stage 2 per-site builder cap to the active wall segment. Reserved wall workers
that cannot work because of missing materials or routing remain unavailable to
production; this makes proclamation visibly costly.

The remaining workers staff production buildings in their existing stable
order, then ordinary construction sites. After 600 ticks, the special quota
ends: production regains its normal priority, while the next wall segment
continues competing for ordinary construction labour. Gate-outward ordering
remains enforced until completion.

The harness must compare the same scenario before and after proclamation to
prove that production decreases but never halts entirely.

## Completion, protection, and housing

Completing a wall site removes that construction site and adds one finished
`PalisadeSegment`. It does not create a building or house. The wall is complete
only when every confirmed segment is finished.

Once complete, point-in-polygon tests derive whether each finished building is
inside. These results do not alter placement or pathfinding.

- an inside house reports `성벽 안 ✅ 편의 +2`;
- an outside house reports `성벽 밖 — 3등급 불가`;
- outside houses below level 3 cannot upgrade to level 3;
- an outside house already at level 3 is never downgraded because of the wall;
- no building is destroyed or moved;
- before wall completion, the level cap and amenity bonus do not apply.

The `+2` amenity is a derived palisade bonus exposed to diagnosis/UI. Stage 3
does not introduce a general desirability score, a new housing requirement, or
another progression axis.

## Ceremony and material wave

The confirmed action immediately sets `era: "palisade"`. React detects the
transition and shows a two-second, dismissible ceremony layer with the new era
name. Canvas draws a short palette-safe flourish at the gate.

House material is a pure render function of `era × house level`. No material
field is stored on a house, and housing behaviour is identical for otherwise
equal hamlet and palisade states.

On the observed era transition, houses are sorted by distance from settlement
centre with building id as a tie-break. Their timber-to-plaster render variant
appears in that order over four seconds, within the specified three-to-five
second range. Reloading an already proclaimed state renders the final material
without replaying or mutating the simulation.

## UI and reading the state

The court console adds a compact era panel with four separate rows. It never
collapses them into one percentage. The button is enabled only when every row
is met and a valid proposal exists. Its accessible tooltip text is exactly:

`선포하면 일꾼의 40%가 성벽 공사에 배정됩니다 (약 600틱)`

The console always shows the current era. During construction it also shows
`성벽 N / M 구간`. The confirmed polygon remains a faint dashed overlay for
unfinished portions. Completed segments render as palisade, while the active
site uses the Stage 2 marked-plot, foundation, frame, and roof vocabulary
adapted to a linear wall footprint.

The construction diagnostic card keeps the four Stage 2 rows and shows the
existing actionable Korean stall label for active wall sites. Queued wall
segments identify their gate-outward position without pretending to be stalled.

All new Korean UI uses `word-break: keep-all`, fits at 375, 768, and 1280 pixels,
and uses only the canonical palette and existing texture assets.

## Determinism and harness

The determinism serializer must include every gameplay-relevant Stage 3 field:

- `era` and `eraProclaimedTick`;
- confirmed polygon and gate;
- ordered planned, active, and completed wall segments;
- wall-specific construction metadata;
- housing state affected by the outside-wall upgrade cap.

Presentation-only edit drafts, ceremony timers, and material-wave clocks are
excluded.

The scripted Stage 3 scenario starts from a reachable economy, reaches all four
requirements, invokes proclamation at a fixed tick with a fixed candidate
polygon, and runs through wall completion. It records:

- proclamation tick and time to reach it;
- completion tick and elapsed wall-construction ticks;
- Reachability: fail if not proclaimable by tick 12000;
- Wall completion: fail if unfinished 3000 ticks after proclamation;
- Labour starvation: fail if production halts entirely during wall construction;
- Determinism: same seed and proclamation tick must produce identical final
  state and hash.

The report records old hash `5a393f13af3e61be` and the new baseline from two
independent identical runs.

## Verification and evidence

Implementation follows characterization-first TDD. Every behaviour change gets
a passing characterization of the existing seam, then a failing assertion for
the new outcome, then the minimal production change.

Required automated coverage includes all twelve goal tests: independent
requirements, rejection gates, proposal margin/water safety, invalid adjustment,
deterministic gate-outward order, Stage 2 stalls, presentation-only material,
outside-wall preservation and level cap, the existing 549-test baseline, and
palette boundary guards.

Final heavy verification runs on DGX:

- `npm test` with every test passing;
- `npm run typecheck`;
- `npm run build`;
- `npm run harness` twice with identical new hash and all era metrics passing;
- ffmpeg-backed asset boundary tests;
- three 5× render benchmark runs, all below 12 ms;
- HTTP root and every referenced JS/CSS asset;
- real Chromium QA at 1280, 768, and 375 pixels.

The final report contains five real screenshots: partially complete requirement
gauges, dashed proposal, proclamation ceremony, half-built wall with an
actionable stalled segment, and completed wall enclosing the settlement.

## Scope exclusions

- no era beyond `palisade`;
- no zoning, policies, advisors, raids, combat, or wall damage;
- no build permission restriction based on the wall;
- no wall pathfinding blocker or gate routing simulation;
- no general desirability subsystem;
- no new housing levels or independent material progression;
- no new dependencies or generated sprite family;
- no changes to Stage 2 construction semantics for ordinary buildings except
  the exhaustive generalized site type and the era-specific labour allocator.
