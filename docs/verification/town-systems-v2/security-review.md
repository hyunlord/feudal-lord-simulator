# Security and state-integrity review

Verdict: PASS for the scoped changes versus 6684a6a. No blocking security or state-integrity defect found. Read-only product review; only this evidence file was written.

## Verified boundaries

- `autoplayServices.ts` proposes actions only. Candidate evaluation calls existing `canPlaceBuilding` (era, bounds, occupied buildings/roads/construction, wall clearance and real available materials), plus connected construction routing. `autoplayActions.ts` converts to ordinary commands; `gameActions.ts:placeBuilding` revalidates against current state and creates an ordinary construction site. No free completed building or injected resources.
- Temporary candidate workers and all-road copies exist only in local planning inputs. They are not returned as product state. Actual staffing and roads continue through normal engine allocation and reducer validation.
- Road repair uses existing bounded graph search, marks visited nodes, checks legal road placement and wall boundaries. Candidate scanning is finite over map tiles; road fallback is limited to 24 candidates per service. No unbounded retry/recursion introduced. This is not a worst-case map performance certification.
- Market settlement still subtracts exactly one unit from the selected source, respects `stockReserved`, returns new arrays/records, and computes each successive market against updated inventories. Two markets cannot spend the same surplus unit above the new civic floor. Coin is created only by the pre-existing sale rule.
- The shared palisade footprint function includes full footprints of unfinished buildings as well as completed buildings. Preview, advisor and confirmation reuse it. Confirmation still validates the candidate and returns unchanged state when rejected.
- Renderer changes remove automatic normal-view transparency and put road repaint before raised objects. They do not modify world occupancy, inventories, saves or commands.
- No dependency, network, credential, persistence, executable evaluation or production fixture-injection changes in the inspected product diff. Evidence capture state overrides are outside shipped product scope.

## Independent verification

Command: `node --import tsx --test tests/autoplayServices.test.ts tests/marketSettlement.test.ts tests/palisadeProclamation.test.ts`

Refreshed result: 35 tests passed, 0 failed (193 ms reported duration). Includes legal reducer-applied service placement, unaffordable action rejection, staffing, pending-build duplication prevention, stock reservation and multi-market floors, and wall rejection through construction footprints.

## Follow-up reserve and route changes verified

- `civicConstructionReserve` now sums `constructionDeliveryNeed` across pending church sites. Required minus delivered minus already-reserved deliveries protects still-unclaimed timber and stone; `stockReserved` remains excluded separately at each source. This fixes the earlier pre-placement-only limitation. The partial-delivery test checks delivered 20/10 plus reserved 10/15 against required 100/60 yields an additional reserve of 70/35, and only genuine surplus exports.
- `tick.ts` passes `labour.constructionSites` into market settlement, consistent with the same tick's moved deliveries and labour buildings. The reserve no longer uses the opening construction snapshot after delivery progress.
- `autoplayFoodPlacement.ts` filters candidates through the same legal-placement and clearance checks, evaluates real existing-road routes to granaries, and sorts finite candidates by summed route length with stable coordinate ties. The local virtual buildings have no inventory and are never committed; returned route-cache extensions are not written into game state. Actual building commands retain reducer revalidation and ordinary delivery costs. No geometric-distance shortcut through walls or occupied land was introduced.
- Protection is scoped to church construction, not an asserted universal reserve policy for every building type. A market component may conservatively retain a reserve even when another component contains the relevant construction source; that is extra retained inventory, not duplication or reservation corruption. No guarantee of arbitrary-map growth or frame-time bounds is implied by this review.
