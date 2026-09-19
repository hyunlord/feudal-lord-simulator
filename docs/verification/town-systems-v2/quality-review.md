# Town systems v2 independent code-quality review

Status: PASS after construction-reserve and additional food-placement corrections (2026-09-20). No unresolved blocking finding in reviewed diff.

Scope: playable worktree diff against 6684a6a; palisadeFootprints, road/opaque rendering, autoplayServices, autoplayCivicReserve, marketSettlement. Read-only reviewer; no product edits.

## Resolved finding

P1: Newly placed church loses its material protection before transport reserves the remaining inputs. `autoplayCivicReserve.ts` returns zero whenever a church construction site exists; `gameActions.ts:placeBuilding` only creates a site and marks occupancy. Stock is consumed a cartload at a time in deliveryConstruction. `marketSettlement.ts` therefore exports materials still committed to the church. The initial planned-church test explicitly permits this unsafe release. Protect constructionDeliveryNeed (required minus delivered minus already reserved transit), using current constructionSites during tick settlement. Release after completion or reevaluate actual unmet demand after cancellation. Parent and growth executor notified.

Correction independently verified: church construction now retains the sum of required-minus-delivered-minus-reserved material demand. Market settlement receives current labour.constructionSites from tick, avoiding stale delivery data. Planned-church sale expectations were corrected, and partial-delivery/transit plus cancellation tests added. Multiple-market sales still preserve the floor.

## Verified boundaries

- Ground road repaint moved before upright object queue, retaining the same road geometry. Normal houses no longer become transparent under cursor or dense neighborhoods. Outline view remains explicit.
- Wall preview, advisor action conversion and confirmation use shared full completed-building plus construction-site footprints. Actual placement and wall traversal retain their prior clearance checks.
- Civic advisor uses real placement affordability, clearance, construction routes and projected finite service allocation; no free resources or dependencies added.
- New facilities require real idle workforce. Existing disconnected providers are repaired first; understaffing does not trigger duplicates. Pending providers suppress duplicate planning.
- Market sells one physical inventory unit per eligible market settlement and uses updated inventory between markets. Existing stockReserved exclusion remains intact.

## Commands and evidence

`node --import tsx --test tests/autoplayServices.test.ts tests/marketSettlement.test.ts tests/palisadeProclamation.test.ts tests/phase14Part2Occlusion.test.ts tests/phase13Part6Rendering.test.ts`

52 tests passed, 0 failed after reservation and food-placement corrections. Exact output: `quality-review-tests.log`.

`npm run typecheck` passed. `git diff --check` passed.

This is code-quality and bounded regression evidence, not browser visual approval or natural-economy completion proof. Those remain separate parent-owned gates.

## Limits

- Civic reserves are conservative per market-connected storage network, not an optimized global reservation allocator. This can retain more stock across disconnected networks but does not create or oversell inventory.
- Automatic post-era growth guarantees neither arbitrary impossible terrain nor a globally optimal civic layout. Actual natural-economy progress must be supported by the separate unseeded run.
- Existing object-sort handling and deliberate outline transparency remain; the review does not claim every conceivable legacy-invalid wall/building state is repaired.

## Additional food-placement review

P2: lateFoodBuildSites rejects every candidate when any granary is unreachable. Independent 30x26 fixture has 40 legal routed candidates with connected granary (18,13), then zero after an isolated granary (25,2) is added. This lets unrelated disconnected storage block normal production expansion. Keep reachable-path scoring and reject only zero-reachable candidates. Existing buildAction still has its separate planned-road fallback; that fallback was not removed. Finding sent to growth executor.

Correction independently verified: food scoring filters unreachable granaries and rejects only zero-reachable candidates. It scores actual road paths rather than Euclidean proximity and retains deterministic coordinate tie-breaking; new winding-route and isolated-granary regressions pass. Existing generic planned-road fallback remains. All-connected natural-run ranking is unchanged by this fix. The score remains a heuristic over reachable granaries, not capacity-weighted or globally optimal distribution planning. Final reserve/tick logic remains as reviewed above.
