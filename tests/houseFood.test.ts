import { BALANCE } from "../src/content/balanceConfig";
import { houseBreadCapacity, houseGrowthPhase, houseIsStarving } from "../src/population/houseFood";

import assert from "node:assert/strict";
import test from "node:test";
import { updateHouse } from "../src/population/housing";
import type { House } from "../src/population/population.types";
const home = (extra: Partial<House> = {}): House => ({ buildingId: "home", level: 2, residents: 9, hasWater: true, breadStock: 6, lastServicedTick: 0, unmetRequirementTicks: 0, ...extra });
test("occupied households consume population-sized rations every 400 ticks", () => {
  const before = updateHouse(home(), { tick: 399, hasGranaryNearby: false });
  const after = updateHouse(before, { tick: 400, hasGranaryNearby: false });
  assert.equal(before.breadStock, 6);
  assert.equal(after.breadStock, 4);
  assert.equal(after.level, 2);
});
test("held bread supports housing despite an old delivery date", () => {
  assert.equal(updateHouse(home(), { tick: 999, hasGranaryNearby: false }).unmetRequirementTicks, 0);
});
test("empty houses consume nothing", () => {
  assert.equal(updateHouse(home({ residents: 0 }), { tick: 400, hasGranaryNearby: false }).breadStock, 6);
});

test("starvation tracks consecutive empty ticks and resets after delivery", () => {
  let current = home({ breadStock: 0, starvationGraceUntilTick: 10 });
  for (let tick = 1; tick <= 310; tick++) current = updateHouse(current, { tick, hasGranaryNearby: false });
  assert.equal(current.emptyFoodTicks, 300);
  assert.equal(houseIsStarving(current, 310), false);
  current = updateHouse(current, { tick: 311, hasGranaryNearby: false });
  assert.equal(houseIsStarving(current, 311), true);
  current = updateHouse({ ...current, breadStock: 1 }, { tick: 312, hasGranaryNearby: false });
  assert.equal(current.emptyFoodTicks, 0);
  assert.equal(houseIsStarving(current, 312), false);
});

test("growth is phased, needs food outside grace, and can refill vacant houses", () => {
  const phase = houseGrowthPhase("home") || BALANCE.GROWTH_INTERVAL;
  const context = { tick: phase, hasGranaryNearby: false };
  assert.equal(updateHouse(home({ residents: 0 }), context).residents, 1);
  assert.equal(updateHouse(home({ residents: 4, breadStock: 0 }), context).residents, 4);
  assert.equal(updateHouse(home({ residents: 4, breadStock: 0, starvationGraceUntilTick: 1000 }), context).residents, 5);
  assert.equal(updateHouse(home({ residents: 4 }), { ...context, tick: phase + 1 }).residents, 4);
  assert.notEqual(houseGrowthPhase("home-a"), houseGrowthPhase("home-b"));
});

test("ration capacity scales with residents, retaining a minimum for empty homes", () => {
  assert.equal(houseBreadCapacity({ residents: 0 }), 3);
  assert.equal(houseBreadCapacity({ residents: 9 }), 6);
  assert.equal(houseBreadCapacity({ residents: 32 }), 12);
});
