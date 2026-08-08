import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import { createConstructionSite } from "../src/economy/construction";
import { decideNextAction, type AutoplayAction } from "../src/engine/autoplay";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { House } from "../src/population/population.types";
import {
  autoplayActionLabel,
  autoplayActionPulseTile,
  autoplayActionToGameAction,
  AUTOPLAY_COMMIT_DELAY_MS,
  canRunAutoplayAtTick,
  presentThenScheduleAutoplayAction,
} from "../src/ui/autoplayPresentation";
import type { Tile } from "../src/world/world.types";
import { trackAutoplayRun } from "../scripts/economyHarnessAutoplay";
import { formatEconomyHarnessReport, runMainEconomyHarness } from "../scripts/economyHarness";
import { hashEconomyState } from "../scripts/economyHarnessSerializer";

function building(input: {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
  readonly inventory?: Partial<Record<ResourceType, number>>;
  readonly workers?: number;
}): Building {
  return {
    id: input.id,
    kind: input.kind,
    tx: input.tx,
    ty: input.ty,
    workers: input.workers ?? 0,
    inventory: input.inventory ?? {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function house(buildingId: string, patch: Partial<House> = {}): House {
  return {
    buildingId,
    level: 0,
    residents: 4,
    hasWater: false,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
    ...patch,
  };
}

function tiles(buildings: readonly Building[], roads: readonly string[] = ["1,5", "2,5", "3,5"]): Tile[] {
  return Array.from({ length: 12 * 12 }, (_unused, index): Tile => {
    const tx = index % 12;
    const ty = Math.floor(index / 12);
    const owner = buildings.find((candidate) => {
      const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
      return tx >= candidate.tx &&
        tx < candidate.tx + definition.width &&
        ty >= candidate.ty &&
        ty < candidate.ty + definition.height;
    });
    return {
      tx,
      ty,
      terrain: tx === 0 ? "forest" : "grass",
      buildingId: owner?.id ?? null,
      hasRoad: roads.includes(`${tx},${ty}`),
    };
  });
}

function state(input: {
  readonly buildings: readonly Building[];
  readonly houses?: readonly House[];
  readonly roads?: readonly string[];
  readonly population?: number;
  readonly idleWorkers?: number;
  readonly timber?: number;
  readonly coin?: number;
  readonly tick?: number;
  readonly era?: GameState["era"];
}): GameState {
  const houses = input.houses ?? [];
  return {
    tick: input.tick ?? 0,
    seed: 1,
    width: 12,
    height: 12,
    tiles: tiles(input.buildings, input.roads),
    buildings: [...input.buildings],
    constructionSites: [],
    houses: [...houses],
    walkers: [],
    population: input.population ?? houses.reduce((total, candidate) => total + candidate.residents, 0),
    idleWorkers: input.idleWorkers ?? 0,
    treasuryTimber: input.timber ?? 500,
    treasuryCoin: input.coin ?? 0,
    wallTick: input.tick ?? 0,
    era: input.era ?? "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    forestHarvests: [],
    nextConstructionOrdinal: 1,
    roadRevision: 1,
    pathCache: {},
  };
}

function assertAction(actual: AutoplayAction, expected: AutoplayAction): void {
  assert.deepEqual(actual, expected);
}

test("Given an unwatered house cluster When autoplay decides Then it builds the earliest valid well within radius six", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const actual = decideNextAction(state({ buildings: [home], houses: [house(home.id)] }));

  assertAction(actual, { kind: "place_building", building: "well", tx: 5, ty: 4 });
});

test("Given separated unwatered clusters When one well cannot cover all Then autoplay serves the most deprived cluster", () => {
  const early = building({ id: "house-a", kind: "house", tx: 2, ty: 2 });
  const deprived = building({ id: "house-b", kind: "house", tx: 9, ty: 9 });
  const actual = decideNextAction(state({
    buildings: [early, deprived],
    houses: [
      house(early.id, { unmetRequirementTicks: 1 }),
      house(deprived.id, { unmetRequirementTicks: 500 }),
    ],
  }));

  assertAction(actual, { kind: "place_building", building: "well", tx: 9, ty: 8 });
});

test("Given a roadless idle building When autoplay decides Then it places the nearest legal road segment from the connected road edge", () => {
  const storehouse = building({ id: "storehouse-a", kind: "storehouse", tx: 7, ty: 4, workers: 0 });
  const actual = decideNextAction(state({ buildings: [storehouse], roads: ["1,5", "2,5", "3,5"] }));

  assertAction(actual, {
    kind: "place_road",
    from: { tx: 4, ty: 5 },
    to: { tx: 6, ty: 5 },
  });
});

test("Given low bread and no food chain When autoplay decides repeatedly Then it follows wheat farm, mill, granary priority before timber recovery", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const well = building({ id: "well-a", kind: "well", tx: 5, ty: 4 });
  const wheat = building({ id: "wheat-a", kind: "wheat_farm", tx: 2, ty: 2 });
  const mill = building({ id: "mill-a", kind: "mill", tx: 4, ty: 2 });
  const base = { houses: [house(home.id, { hasWater: true, breadStock: 0, lastServicedTick: -10_000 })], timber: 500 };

  const accessedBase = { ...base, roads: ["1,5", "2,5", "3,5", "5,6", "2,4", "4,3"] };

  assert.deepEqual(decideNextAction(state({ ...accessedBase, buildings: [home, well] })), {
    kind: "place_building",
    building: "wheat_farm",
    tx: 1,
    ty: 1,
  });
  assert.deepEqual(decideNextAction(state({ ...accessedBase, buildings: [home, well, wheat] })), {
    kind: "place_building",
    building: "mill",
    tx: 1,
    ty: 1,
  });
  assert.deepEqual(decideNextAction(state({ ...accessedBase, buildings: [home, well, wheat, mill] })), {
    kind: "place_building",
    building: "granary",
    tx: 5,
    ty: 1,
  });
});

test("Given low timber When food is stable Then autoplay builds logging camp before sawmill and skips invalid placements", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const well = building({ id: "well-a", kind: "well", tx: 5, ty: 4 });
  const logging = building({ id: "logging-a", kind: "logging_camp", tx: 1, ty: 1 });
  const hydratedFed = house(home.id, { hasWater: true, breadStock: 20, lastServicedTick: 0 });

  const roads = ["1,2", "1,5", "2,5", "3,5", "5,6"];

  assert.deepEqual(state({ buildings: [home, well], houses: [hydratedFed], timber: 35, roads }).tiles[0]?.terrain, "forest");
  assert.deepEqual(decideNextAction(state({ buildings: [home, well], houses: [hydratedFed], timber: 35, roads })), {
    kind: "place_building",
    building: "logging_camp",
    tx: 1,
    ty: 1,
  });
  assert.deepEqual(decideNextAction(state({ buildings: [home, well, logging], houses: [hydratedFed], timber: 35, roads })), {
    kind: "place_building",
    building: "sawmill",
    tx: 2,
    ty: 1,
  });
});

test("Given spare labour and housing capacity When autoplay decides Then it adds the deterministic road-adjacent house", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const well = building({ id: "well-a", kind: "well", tx: 5, ty: 4 });
  const actual = decideNextAction(state({
    buildings: [home, well],
    houses: [house(home.id, { hasWater: true, breadStock: 20, residents: 4, lastServicedTick: 0 })],
    idleWorkers: 7,
    roads: ["1,5", "2,5", "3,5", "5,6"],
  }));

  assertAction(actual, { kind: "place_building", building: "house", tx: 1, ty: 4 });
});

test("Given era requirements When one building is missing or all are met Then autoplay builds the missing building or proclaims", () => {
  const granary = building({ id: "granary-a", kind: "granary", tx: 1, ty: 1 });
  const chapel = building({ id: "chapel-a", kind: "chapel", tx: 3, ty: 1 });
  const ready = { population: 60, timber: 250 };

  assert.deepEqual(decideNextAction(state({ ...ready, buildings: [granary], roads: ["1,3", "2,3", "3,3"] })), {
    kind: "place_building",
    building: "chapel",
    tx: 3,
    ty: 1,
  });
  assert.deepEqual(decideNextAction(state({ ...ready, buildings: [granary, chapel], roads: ["1,3", "2,3", "3,2", "3,3"] })), { kind: "proclaim_era" });
});

test("Given autoplay presentation state When mapping actions Then hint, pulse, pacing, dispatch, and hash isolation stay outside GameState", () => {
  const action = { kind: "place_building", building: "well", tx: 5, ty: 4 } satisfies AutoplayAction;

  assert.equal(autoplayActionLabel(action), "다음: 우물 건설");
  assert.deepEqual(autoplayActionPulseTile(action), { tx: 5, ty: 4 });
  assert.deepEqual(autoplayActionToGameAction(action), { type: "place_building", kind: "well", tx: 5, ty: 4 });
  assert.equal(canRunAutoplayAtTick({ enabled: false, currentTick: 240, lastActionTick: 0 }), false);
  assert.equal(canRunAutoplayAtTick({ enabled: true, currentTick: 119, lastActionTick: 0 }), false);
  assert.equal(canRunAutoplayAtTick({ enabled: true, currentTick: 120, lastActionTick: 0 }), true);
  assert.equal(AUTOPLAY_COMMIT_DELAY_MS > 16, true);
  assert.equal(AUTOPLAY_COMMIT_DELAY_MS < 600, true);
  assert.equal(Object.hasOwn(DEFAULT_GAME_STATE, "autoplayEnabled"), false);
  assert.equal(Object.hasOwn(DEFAULT_GAME_STATE, "autoplayNextAction"), false);
  assert.equal(hashEconomyState(DEFAULT_GAME_STATE), hashEconomyState(DEFAULT_GAME_STATE));
});

test("Given an autoplay action When it is presented Then pulse publication precedes a delayed commit", () => {
  const action = { kind: "place_building", building: "well", tx: 5, ty: 4 } satisfies AutoplayAction;
  const order: string[] = [];
  const pendingCommit: { current: (() => void) | null } = { current: null };
  let cancelled = false;

  const cancel = presentThenScheduleAutoplayAction({
    action,
    state: DEFAULT_GAME_STATE,
    publishPulse: () => { order.push("pulse"); },
    schedule: (commit, delayMs) => {
      order.push(`delay:${delayMs}`);
      pendingCommit.current = commit;
      return () => { cancelled = true; };
    },
    dispatch: () => { order.push("dispatch"); },
  });

  assert.notEqual(cancel, null);
  assert.deepEqual(order, ["pulse", `delay:${AUTOPLAY_COMMIT_DELAY_MS}`]);
  assert.notEqual(pendingCommit.current, null);
  pendingCommit.current?.();
  assert.deepEqual(order, ["pulse", `delay:${AUTOPLAY_COMMIT_DELAY_MS}`, "dispatch"]);
  cancel?.();
  assert.equal(cancelled, true);
});

test("Given a pending autoplay commit When automation is disabled Then cancellation prevents the dispatch", () => {
  const action = { kind: "place_building", building: "well", tx: 5, ty: 4 } satisfies AutoplayAction;
  const order: string[] = [];
  const pendingCommit: { current: (() => void) | null } = { current: null };

  const cancel = presentThenScheduleAutoplayAction({
    action,
    state: DEFAULT_GAME_STATE,
    publishPulse: () => { order.push("pulse"); },
    schedule: (commit) => {
      let active = true;
      pendingCommit.current = () => { if (active) commit(); };
      return () => { active = false; };
    },
    dispatch: () => { order.push("dispatch"); },
  });

  cancel?.();
  pendingCommit.current?.();
  assert.deepEqual(order, ["pulse"]);
});

test("Given a busy roadless building When autoplay decides Then the idle-building road priority skips it", () => {
  const busyStorehouse = building({ id: "storehouse-a", kind: "storehouse", tx: 7, ty: 4, workers: 1 });
  const actual = decideNextAction(state({ buildings: [busyStorehouse], roads: ["1,5", "2,5", "3,5"] }));

  assert.notEqual(actual.kind, "place_road");
});

test("Given a food-chain construction site When autoplay decides Then it does not recommend the same building again", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const well = building({ id: "well-a", kind: "well", tx: 5, ty: 4 });
  const current = state({
    buildings: [home, well],
    houses: [house(home.id, { hasWater: true, breadStock: 0 })],
    roads: ["1,5", "2,5", "3,5", "5,6"],
  });
  current.constructionSites = [createConstructionSite({ ordinal: 1, kind: "wheat_farm", tx: 1, ty: 1, startedTick: 0 })];

  assert.notDeepEqual(decideNextAction(current), { kind: "place_building", building: "wheat_farm", tx: 1, ty: 1 });
});

test("Given a well or cottage is already under construction When autoplay decides Then it does not queue duplicates", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const current = state({
    buildings: [home],
    houses: [house(home.id, { breadStock: 20 })],
    idleWorkers: 7,
    timber: 500,
    roads: ["1,5", "2,5", "3,5", "5,6"],
  });
  current.constructionSites = [
    createConstructionSite({ ordinal: 1, kind: "well", tx: 5, ty: 4, startedTick: 0 }),
    createConstructionSite({ ordinal: 2, kind: "house", tx: 1, ty: 4, startedTick: 0 }),
  ];

  assert.deepEqual(decideNextAction(current), { kind: "none" });
});

test("Given the only missing era building is under construction When autoplay decides Then it waits", () => {
  const granary = building({ id: "granary-a", kind: "granary", tx: 1, ty: 1 });
  const current = state({ buildings: [granary], population: 60, timber: 250, roads: ["1,3", "2,3", "3,3"] });
  current.constructionSites = [createConstructionSite({ ordinal: 1, kind: "chapel", tx: 3, ty: 1, startedTick: 0 })];

  assert.deepEqual(decideNextAction(current), { kind: "none" });
});

test("Given Stone Town is already proclaimed When autoplay decides Then it waits without a false proclamation hint", () => {
  const current = state({ buildings: [], era: "stone_town", population: 200, timber: 500, coin: 500 });

  const action = decideNextAction(current);
  assert.deepEqual(action, { kind: "none" });
  assert.equal(autoplayActionLabel(action), "다음: 대기");
});

test("Given the main balance harness consumer When it runs Then shared autoplay advice is deterministic without changing fourteen metrics", () => {
  const report = runMainEconomyHarness([]);

  assert.equal(report.metrics.length, 14);
  assert.equal(report.autoplay.hashA, report.autoplay.hashB);
  assert.equal(report.autoplay.actionCount > 0, true);
  assert.match(formatEconomyHarnessReport(report), /Autoplay advisor\s+\d+ actions, \S+ == \S+\s+PASS/);
});

test("autoplay advisor stays below the source ceiling and uses canonical TilePos endpoints", () => {
  const source = readFileSync(new URL("../src/engine/autoplay.ts", import.meta.url), "utf8");
  const typesSource = readFileSync(new URL("../src/engine/autoplay.types.ts", import.meta.url), "utf8");
  const pureLoc = source
    .split("\n")
    .filter((line) => !/^\s*$/.test(line))
    .filter((line) => !/^\s*(\/\/|#|--)/.test(line)).length;

  assert.equal(pureLoc <= 250, true, `autoplay.ts has ${pureLoc} pure LOC`);
  assert.match(typesSource, /import type \{ TilePos \} from "\.\.\/agents\/walker\.types"/);
  assert.match(typesSource, /readonly from: TilePos; readonly to: TilePos/);
  assert.doesNotMatch(typesSource, /TileCoordinate/);
});

test("Given the economy harness When autoplay runs Then it uses the same advisor decisions without duplicate scripted logic", () => {
  const source = readFileSync(new URL("../scripts/economyHarnessAutoplay.ts", import.meta.url), "utf8");
  const base = state({ buildings: [building({ id: "house-a", kind: "house", tx: 5, ty: 5 })], houses: [house("house-a")] });
  const report = trackAutoplayRun({ initialState: base, ticks: 240 });

  assert.match(source, /decideNextAction/);
  assert.equal(report.appliedActions.length > 0, true);
  assert.deepEqual(report.appliedActions[0]?.advisorAction, decideNextAction(base));
});
