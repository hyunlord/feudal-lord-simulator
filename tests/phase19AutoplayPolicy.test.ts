import assert from 'node:assert/strict';
import test from 'node:test';
import { decideNextAction } from '../src/engine/autoplay';
import { BUILDING_CONFIG_BY_KIND } from '../src/content/buildingConfig';
import type { GameState } from '../src/engine/engine.types';
import { connectedHousingFixture } from './efficientHousingFixtures';

// AF-13: the fixture's wheat farm is retired; the grain slot is now a 1x1 farmstead. It moves onto the
// wheat farm's old footprint, beside the road at ty 7, so it keeps the same required road access.
function withFarmstead(state: GameState): GameState {
  return {
    ...state,
    buildings: state.buildings.map(building => building.kind === 'wheat_farm'
      ? { ...building, kind: 'farmstead' as const, ty: building.ty + 1, workers: BUILDING_CONFIG_BY_KIND.farmstead.workersRequired }
      : building),
  };
}

test("Given an eligible housing site When default advisor runs Then the existing housing choice is preserved", () => {
  const action = decideNextAction(withFarmstead(connectedHousingFixture()));
  assert.equal(action.kind === "place_building" && action.building, "house");
});

test("Given four lots and an explicit four-lot limit When advisor runs Then it does not add a fifth lot", () => {
  const action = decideNextAction(withFarmstead(connectedHousingFixture()), { maxHousingLots: 4 });
  assert.notEqual(action.kind === "place_building" && action.building, "house");
});

test("Given an eligible housing site When default and explicit eight are compared Then recommendations match", () => {
  assert.deepEqual(decideNextAction(withFarmstead(connectedHousingFixture())), decideNextAction(withFarmstead(connectedHousingFixture()), { maxHousingLots: 8 }));
});

test("Given eligible stone-town housing pressure When cap is raised Then post-era routing continues guarded housing expansion", () => {
  const current = { ...withFarmstead(connectedHousingFixture()), era: "stone_town" as const };
  const action = decideNextAction(current, { maxHousingLots: 48 });
  assert.equal(action.kind === "place_building" && action.building, "house");
});
