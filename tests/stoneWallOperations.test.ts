import assert from "node:assert/strict";
import test from "node:test";

import type { ConstructionSite } from "../src/economy/construction";
import { cancelConstruction } from "../src/engine/constructionCancellation";
import { allocateBuildingAndConstructionLabour } from "../src/population/labour";
import { DELIVERY_INVENTORY, building as fixtureBuilding, line, routePort } from "./deliveryFixtures";
import { building, palisade, palisadeSegment, state, stoneSite } from "./stoneWallConversionFixtures";

test("Given a Stone Town replacement site When cancellation is requested Then cancellation is a no-op", () => {
  // Given
  const target = stoneSite(0, { delivered: { stone: 10 }, reserved: { stone: 15 }, assignedBuilders: 3 });
  const current = state({
    era: "stone_town",
    constructionSites: [target],
    palisade: palisade([palisadeSegment(0, { replacementConstructionSiteId: target.id })]),
    buildings: [fixtureBuilding("store-a", "storehouse", { tx: 0, ty: 0 })],
  });

  // When
  const result = cancelConstruction({
    state: current,
    siteId: target.id,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({ "2,0->store-a": line([2, 0], [1, 0], [0, 0]) }),
  });

  // Then
  assert.equal(result.state, current);
  assert.deepEqual(result.ledger.deliveredRefund, {});
  assert.deepEqual(result.ledger.reservedRefund, {});
  assert.deepEqual(result.ledger.treasuryRefund, {});
  assert.deepEqual(result.ledger.dropped, {});
});

test("Given Stone Town labour reservation When mixed sites exist Then only the active stone wall site receives the fifty percent target", () => {
  // Given
  const farm = building("farm-a", "wheat_farm", 8, 8);
  const activeStone = stoneSite(0, { delivered: { stone: 25 } });
  const queuedStone = stoneSite(1, { delivered: { stone: 25 } });
  const arbitraryBuildingSite: ConstructionSite = {
    id: "construction-site-000009",
    kind: "market",
    tx: 10,
    ty: 10,
    required: {},
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 700,
    assignedBuilders: 0,
    stall: "no_builders",
    startedTick: 100,
  };

  // When
  const result = allocateBuildingAndConstructionLabour(
    [farm],
    [arbitraryBuildingSite, queuedStone, activeStone],
    20,
    { era: "stone_town", tick: 100, eraProclaimedTick: 100 },
  );

  // Then
  assert.equal(result.diagnostics.palisadeEraLabour.activeSiteId, activeStone.id);
  assert.deepEqual(result.constructionSites.map((site) => [site.id, site.assignedBuilders]), [
    ["construction-site-000009", 1],
    ["wall-a-segment-001-stone", 0],
    ["wall-a-segment-000-stone", 3],
  ]);
});
