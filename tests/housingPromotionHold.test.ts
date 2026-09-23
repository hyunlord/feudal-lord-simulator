import assert from "node:assert/strict";
import test from "node:test";

import { HOUSING_CONFIG } from "../src/content/housingConfig";
import { updateHouse, type HouseUpdateContext } from "../src/population/housing";
import type { House } from "../src/population/population.types";

const fullServices: HouseUpdateContext = {
  tick: 1,
  hasGranaryNearby: true,
  hasMarketAccess: true,
  hasChurchAccess: true,
  palisadeProtection: "inside",
};

function house(level = 0): House {
  return { buildingId: "promotion-home", level, residents: 0, hasWater: true,
    breadStock: 20, lastServicedTick: 0, unmetRequirementTicks: 0 };
}

test("Given all requirements When each stage hold completes Then a house promotes exactly one level", () => {
  let current = house();
  let tick = 1;
  for (const definition of HOUSING_CONFIG.slice(1)) {
    for (let elapsed = 1; elapsed < definition.promotionHoldTicks; elapsed += 1) {
      current = updateHouse({ ...current, breadStock: 20 }, { ...fullServices, tick: tick++ });
      assert.equal(current.level, definition.level - 1);
      assert.equal(current.promotionTicks, elapsed);
    }
    current = updateHouse({ ...current, breadStock: 20 }, { ...fullServices, tick: tick++ });
    assert.equal(current.level, definition.level);
    assert.equal(current.promotionTicks, 0);
  }
});

test("Given a pending promotion When one requirement is lost Then the hold restarts after recovery", () => {
  const required = HOUSING_CONFIG[2].promotionHoldTicks;
  const pending = house(1);
  pending.promotionTicks = required - 2;
  const interrupted = updateHouse({ ...pending, breadStock: 0 }, { ...fullServices, tick: 1 });
  assert.equal(interrupted.level, 1);
  assert.equal(interrupted.promotionTicks, 0);
  assert.equal(updateHouse({ ...interrupted, breadStock: 0 }, { ...fullServices, tick: 2 }).promotionTicks, 0);
  const resumed = updateHouse({ ...interrupted, breadStock: 20 }, { ...fullServices, tick: 3 });
  assert.equal(resumed.promotionTicks, 1);
  assert.equal(resumed.level, 1);
});
