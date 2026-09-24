import assert from "node:assert/strict";
import test from "node:test";
import { createStoneWallConstructionSite } from "../src/economy/construction";
import { setWallConstructionPriority } from "../src/engine/constructionReserve";
import { reserveDeadlock } from "../src/engine/reserveDeadlock";
import { recordTimberAvailability, runProduction } from "../src/engine/simulationProduction";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { building, reserveDeadlockFixture } from "./reserveDeadlockFixture";

test("E3 Given the seed 3 diagnostic deadlock shape When inspected Then reserve deadlock names blocked storage", () => {
  const base = reserveDeadlockFixture();
  const state = {
    ...base,
    buildings: [
      ...base.buildings,
      building("grain-rich-granary", "granary", { inventory: { wheat: 999 } }),
    ],
  };
  const deadlock = reserveDeadlock(state);
  assert.deepEqual(deadlock, {
    kind: "reserve_deadlock",
    siteIds: ["wall-a-segment-000"],
    blockedResource: "stone",
    used: 400,
    capacity: 400,
    window: {
      startTick: 701211,
      throughTick: 703610,
      lastAvailableIncreaseTick: 701210,
      stalledTicks: 2400,
    },
  });
});

test("E4 Given reserve is held while available timber has recently risen When inspected Then no deadlock is reported", () => {
  const state = reserveDeadlockFixture({
    timberProductionWindow: {
      startTick: 701211,
      throughTick: 703610,
      produced: 1,
      productionTicks: [703610],
      availableTimber: 37,
      lastAvailableIncreaseTick: 703610,
    },
  });
  assert.equal(reserveDeadlock(state), null);
});

test("Given a stone-only wall reserve hold When timber is stagnant Then the timber-chain deadlock detector stays quiet", () => {
  const stoneSite = {
    ...createStoneWallConstructionSite({
      id: "wall-a-segment-000-stone",
      wallId: "wall-a",
      segmentIndex: 0,
      gateDistance: 0,
      order: 0,
      path: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
      startedTick: 100,
    }),
    stall: "reserve_held" as const,
  };
  const state = reserveDeadlockFixture({ constructionSites: [stoneSite] });
  assert.equal(reserveDeadlock(state), null);
});

test("Given a reserve deadlock When construction priority is selected Then diagnosis clears and wall material moves", () => {
  const houseBuildings = DEFAULT_GAME_STATE.buildings.filter((candidate) => candidate.kind === "house")
    .map((candidate, index) => ({ ...candidate, tx: index * 2, ty: 4 }));
  const ready = reserveDeadlockFixture();
  let state = setWallConstructionPriority({
    ...ready,
    buildings: [...ready.buildings, ...houseBuildings],
    houses: DEFAULT_GAME_STATE.houses.map((house) => ({
      ...house, level: 4, builtLevel: 4, residents: 32, breadStock: 100, hasWater: true,
    })),
    population: 128,
  }, "priority");
  assert.equal(reserveDeadlock(state), null);
  for (let tick = 0; tick < 1200; tick += 1) state = advanceTick(state);
  const site = state.constructionSites.find((candidate) => candidate.id === "wall-a-segment-000");
  assert.ok(site);
  assert.equal(site.delivered.timber, 15);
  assert.ok(site.builderTicks > 0);
});

test("Given production runs When available timber rises Then the timber window records the increase tick", () => {
  const readySawmill = building("sawmill-a", "sawmill", {
    kind: "sawmill",
    workers: 2,
    inventory: { logs: 2 },
    productionProgress: 34,
  });
  const state = reserveDeadlockFixture({
    tick: 703611,
    buildings: [readySawmill],
    constructionSites: [],
    timberProductionWindow: {
      startTick: 701212,
      throughTick: 703611,
      produced: 0,
      productionTicks: [],
      availableTimber: 0,
      lastAvailableIncreaseTick: 701211,
    },
  });
  const next = recordTimberAvailability(runProduction(state));
  assert.equal(next.timberProductionWindow?.availableTimber, 1);
  assert.equal(next.timberProductionWindow?.lastAvailableIncreaseTick, 703611);
});
