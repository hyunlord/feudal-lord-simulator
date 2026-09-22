import assert from 'node:assert/strict';
import test from 'node:test';
import { decideNextAction } from '../src/engine/autoplay';
import { connectedHousingFixture } from './efficientHousingFixtures';

test("Given an eligible housing site When default advisor runs Then the existing housing choice is preserved", () => {
  const action = decideNextAction(connectedHousingFixture());
  assert.equal(action.kind === "place_building" && action.building, "house");
});

test("Given four lots and an explicit four-lot limit When advisor runs Then it does not add a fifth lot", () => {
  const action = decideNextAction(connectedHousingFixture(), { maxHousingLots: 4 });
  assert.notEqual(action.kind === "place_building" && action.building, "house");
});

test("Given an eligible housing site When default and explicit eight are compared Then recommendations match", () => {
  assert.deepEqual(decideNextAction(connectedHousingFixture()), decideNextAction(connectedHousingFixture(), { maxHousingLots: 8 }));
});

test("Given eligible stone-town housing pressure When cap is raised Then post-era routing continues guarded housing expansion", () => {
  const current = { ...connectedHousingFixture(), era: "stone_town" as const };
  const action = decideNextAction(current, { maxHousingLots: 48 });
  assert.equal(action.kind === "place_building" && action.building, "house");
});
