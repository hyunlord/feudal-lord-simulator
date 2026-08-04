import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import { BALANCE } from "../src/content/balanceConfig";
import {
  applyWellService,
  updateHouse,
  updateHousing,
} from "../src/population/housing";
import type { House } from "../src/population/population.types";

function building(
  id: string,
  kind: BuildingKind,
  tx: number,
  ty: number,
): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function house(
  buildingId: string,
  input: Partial<House> = {},
): House {
  return {
    buildingId,
    level: 0,
    residents: 4,
    hasWater: false,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
    ...input,
  };
}

test("well service uses a direct Manhattan radius of exactly six tiles", () => {
  const houses = [
    house("house-near"),
    house("house-edge"),
    house("house-far"),
  ];
  const buildings = [
    building("well", "well", 5, 5),
    building("house-near", "house", 7, 7),
    building("house-edge", "house", 11, 5),
    building("house-far", "house", 12, 5),
  ];
  const serviced = applyWellService(houses, buildings);

  assert.deepEqual(
    serviced.map(({ buildingId, hasWater }) => ({ buildingId, hasWater })),
    [
      { buildingId: "house-near", hasWater: true },
      { buildingId: "house-edge", hasWater: true },
      { buildingId: "house-far", hasWater: false },
    ],
  );
});

test("a house immediately evolves to the highest currently satisfied level", () => {
  const waterOnly = updateHouse(
    house("home", { hasWater: true }),
    { tick: 10, hasGranaryNearby: false },
  );
  assert.equal(waterOnly.level, 1);

  const freshBread = updateHouse(
    house("home", {
      hasWater: true,
      breadStock: 1,
      lastServicedTick: 10,
    }),
    { tick: 10 + BALANCE.BREAD_HUNGER_WINDOW, hasGranaryNearby: false },
  );
  assert.equal(freshBread.level, 2);

  const nearGranary = updateHouse(
    house("home", {
      hasWater: true,
      breadStock: 1,
      lastServicedTick: 10,
    }),
    { tick: 10, hasGranaryNearby: true },
  );
  assert.equal(nearGranary.level, 3);
});

test("bread recency does not treat a never-served tick-zero house as fed", () => {
  const neverServed = updateHouse(
    house("home", { hasWater: true, breadStock: 0, lastServicedTick: 0 }),
    { tick: 1, hasGranaryNearby: true },
  );
  assert.equal(neverServed.level, 1);
});

test("devolution waits for 400 continuous unmet ticks", () => {
  let current = house("home", {
    level: 2,
    hasWater: true,
    breadStock: 1,
    lastServicedTick: 0,
  });

  for (let tick = BALANCE.BREAD_HUNGER_WINDOW + 1; tick < BALANCE.BREAD_HUNGER_WINDOW + BALANCE.DEVOLUTION_GRACE; tick += 1) {
    current = updateHouse(current, { tick, hasGranaryNearby: false });
  }
  assert.equal(current.level, 2);
  assert.equal(current.unmetRequirementTicks, BALANCE.DEVOLUTION_GRACE - 1);

  current = updateHouse(current, {
    tick: BALANCE.BREAD_HUNGER_WINDOW + BALANCE.DEVOLUTION_GRACE,
    hasGranaryNearby: false,
  });
  assert.equal(current.level, 1);
  assert.equal(current.unmetRequirementTicks, 0);
});

test("a recovered requirement resets the devolution streak", () => {
  const nearlyUnmet = house("home", {
    level: 2,
    hasWater: true,
    breadStock: 1,
    lastServicedTick: 0,
    unmetRequirementTicks: BALANCE.DEVOLUTION_GRACE - 1,
  });
  const recovered = updateHouse(
    { ...nearlyUnmet, lastServicedTick: 500 },
    { tick: 500, hasGranaryNearby: false },
  );

  assert.equal(recovered.level, 2);
  assert.equal(recovered.unmetRequirementTicks, 0);
});

test("population grows every 50 ticks with water and leaves when bread is absent over 300 ticks", () => {
  const grow = updateHouse(
    house("home", { level: 1, residents: 4, hasWater: true }),
    { tick: BALANCE.GROWTH_INTERVAL, hasGranaryNearby: false },
  );
  assert.equal(grow.residents, 5);

  const boundary = updateHouse(
    house("home", {
      level: 1,
      residents: 5,
      hasWater: true,
      breadStock: 0,
    }),
    { tick: BALANCE.STARVATION_WINDOW, hasGranaryNearby: false },
  );
  assert.equal(boundary.residents, 6);

  const starving = updateHouse(
    house("home", {
      level: 1,
      residents: 5,
      hasWater: true,
      breadStock: 0,
    }),
    {
      tick: BALANCE.STARVATION_WINDOW + BALANCE.GROWTH_INTERVAL,
      hasGranaryNearby: false,
    },
  );
  assert.equal(starving.residents, 4);
});

test("level three granary proximity includes the full 2x2 footprint", () => {
  const buildings = [
    building("home", "house", 2, 2),
    building("well-near", "well", 2, 3),
    building("granary-near", "granary", 14, 2),
  ];
  const result = updateHousing(
    [
      house("home", {
        hasWater: true,
        breadStock: 1,
        lastServicedTick: 10,
      }),
    ],
    buildings,
    10,
  );

  assert.equal(result.houses[0]?.level, 3);
  assert.equal(result.population, 4);
});
