import assert from "node:assert/strict";
import test from "node:test";
import { BALANCE } from "../src/content/balanceConfig";
import { HOUSING_CONFIG } from "../src/content/housingConfig";
import { updateHouse } from "../src/population/housing";
import type { House } from "../src/population/population.types";
import { houseBuiltLevel, houseCondition } from "../src/population/houseCondition";
import { buildBuildingVisualState } from "../src/render/buildingVisualState";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { hashEconomyState, hashOpeningState } from "../scripts/economyHarnessSerializer";

const home: House = { buildingId: "home", level: 4, residents: 12, hasWater: false,
  breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 };

test("lost services preserve the built form through grace, all declines and recovery", () => {
  let current = home;
  for (let tick = 1; tick < BALANCE.DEVOLUTION_GRACE; tick += 1) {
    current = updateHouse(current, { tick: 1, hasGranaryNearby: false });
  }
  assert.equal(current.level, 4);
  assert.equal(houseCondition(current), "maintained");
  for (const level of [3, 2, 1, 0]) {
    for (let tick = level === 3 ? BALANCE.DEVOLUTION_GRACE - 1 : 0; tick < BALANCE.DEVOLUTION_GRACE; tick += 1) {
      current = updateHouse(current, { tick: 1, hasGranaryNearby: false });
    }
    assert.equal(current.level, level);
    assert.equal(houseBuiltLevel(current), 4);
    assert.equal(current.residents, 12);
    assert.equal(current.breadStock, 0);
    assert.equal(houseCondition(current), level === 3 ? "strained" : "neglected");
  }
  const recoveryContext = { tick: 1, hasGranaryNearby: true, hasMarketAccess: true,
    hasChurchAccess: true, palisadeProtection: "inside" as const };
  let restored = updateHouse({ ...current, hasWater: true, breadStock: 2, lastServicedTick: 1 }, recoveryContext);
  assert.equal(restored.level, 0);
  for (const definition of HOUSING_CONFIG.slice(1)) {
    restored = updateHouse({ ...restored, promotionTicks: definition.promotionHoldTicks - 1, breadStock: 2 }, recoveryContext);
    assert.equal(restored.level, definition.level);
  }
  assert.equal(restored.level, 4);
  assert.equal(houseBuiltLevel(restored), 4);
  assert.equal(houseCondition(restored), "maintained");
});

test("vacancy takes priority even before a building declines", () => {
  assert.equal(houseCondition({ ...home, level: 0, residents: 0 }), "vacant");
  assert.equal(houseCondition({ ...home, level: 2, builtLevel: 4, residents: 0 }), "vacant");
  assert.equal(houseCondition({ ...home, level: 4, builtLevel: 4, residents: 0 }), "vacant");
});

test("legacy housing initializes built level before the first downgrade and visual state keeps needs separate", () => {
  const updated = updateHouse({ ...home, unmetRequirementTicks: BALANCE.DEVOLUTION_GRACE - 1 }, { tick: 1, hasGranaryNearby: false });
  assert.equal(updated.builtLevel, 4);
  const visual = buildBuildingVisualState({ id: "home", kind: "house", tx: 1, ty: 1, workers: 0,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 }, [updated]);
  assert.equal(visual.houseLevel, 4);
  assert.equal(visual.houseLivingLevel, 3);
  assert.equal(visual.houseCondition, "strained");
  assert.equal(visual.houseProblem, "water");
});

test("deterministic state hashes record divergent built history but normalize legacy equivalent state", () => {
  const original = { ...DEFAULT_GAME_STATE, houses: [{ ...home, level: 2 }] };
  const maintained = { ...original, houses: [{ ...home, level: 2, builtLevel: 2 }] };
  const declined = { ...original, houses: [{ ...home, level: 2, builtLevel: 4 }] };
  const waiting = { ...maintained, houses: maintained.houses.map(house => ({ ...house, promotionTicks: 400 })) };
  for (const hash of [hashEconomyState, hashOpeningState]) {
    assert.equal(hash(original), hash(maintained));
    assert.notEqual(hash(maintained), hash(declined));
    assert.notEqual(hash(maintained), hash(waiting));
  }
});

 test("long unmet requirements need repairs at the 1200 tick boundary", () => {
  assert.equal(houseCondition({ ...home, unmetRequirementTicks: 1199 }), "maintained");
  assert.equal(houseCondition({ ...home, unmetRequirementTicks: 1200 }), "neglected");
  assert.equal(houseCondition({ ...home, level: 3, builtLevel: 4, unmetRequirementTicks: 1200 }), "neglected");
  assert.equal(houseCondition({ ...home, residents: 0, unmetRequirementTicks: 1200 }), "vacant");
});
