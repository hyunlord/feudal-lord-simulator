/**
 * RECOVER-1 (spec docs/design/recovery.md): in lord mode the vacant houses take the households the vacancies and the
 * labour shortage pull in, whatever the town's stored food (RC-2, RC-4); food then decides whether they stay — a
 * household is short only when its own larder is empty (RC-3); the sandbox and the campaign are untouched (RC-1).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { RECOVERY_BALANCE } from "../src/content/recoveryConfig";
import type { GameState } from "../src/engine/engine.types";
import { labourShortagePermille, migrationPullPermille, vacantForNewcomers } from "../src/engine/recovery";
import { advanceSeasons } from "../src/engine/seasonPressure";
import { initialAgency } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const load = (): GameState => decodeSave(new Uint8Array(readFileSync("fixtures/saves/v50/chapter-two-town.save.json"))).envelope.state as GameState;

/** A town at a season's start whose stores are empty (the reserve is short) and whose first `count` houses stood abandoned. */
function shocked(count: number, lord: boolean): GameState {
  const base = load();
  const tick = (Math.floor(base.tick / SEASON) + 2) * SEASON;
  const lived = base.houses.filter(house => house.residents > 0).map(house => house.buildingId).slice(0, count);
  const state: GameState = {
    ...base, tick,
    buildings: base.buildings.map(building => ({ ...building, inventory: { ...building.inventory, wheat: 0, bread: 0, flour: 0 } })),
    houses: base.houses.map(house => lived.includes(house.buildingId)
      ? { ...house, residents: 0, breadStock: 0, hasWater: true, abandonedTick: tick - RECOVERY_BALANCE.abandonedWaitTicks - 1 } : house),
  };
  return lord ? { ...state, agency: initialAgency() } : state;
}

const runSeason = (state: GameState): GameState => {
  let next = state;
  for (let step = 0; step < SEASON / PRESSURE_BALANCE.sampleTicks; step += 1) next = advanceSeasons({ ...next, tick: state.tick + step * PRESSURE_BALANCE.sampleTicks });
  return next;
};
const abandoned = (state: GameState) => state.houses.filter(house => house.abandonedTick !== undefined).length;

test("RC-1 the sandbox and the campaign keep FP-3: with the town's stores short, no abandoned house is resettled", () => {
  const before = shocked(6, false);
  assert.equal(abandoned(runSeason(before)), abandoned(before));
});

test("RC-2, RC-4 in lord mode the vacant houses take the season's newcomers whatever the stores: ⌈vacant × pull⌉, spread over the season", () => {
  const before = shocked(6, true);
  const vacant = before.houses.filter(house => vacantForNewcomers(house, before.tick)).length;
  assert.ok(vacant >= 6);
  const quota = Math.max(1, Math.ceil(vacant * migrationPullPermille(before) / 1000));
  const half = (() => { let next = before; for (let step = 0; step < 10; step += 1) next = advanceSeasons({ ...next, tick: before.tick + step * PRESSURE_BALANCE.sampleTicks }); return next; })();
  const after = runSeason(before);
  const came = after.houses.filter(house => house.starvationGraceUntilTick !== undefined && house.starvationGraceUntilTick > before.tick && house.residents > 0).length;
  assert.equal(came, Math.min(vacant, quota), `${vacant} vacant, pull ${migrationPullPermille(before)}‰`);
  assert.ok(half.houses.filter(house => (house.starvationGraceUntilTick ?? 0) > before.tick).length <= Math.ceil(quota / 2), "spread over the season, not at once");
  for (const house of after.houses.filter(entry => (entry.starvationGraceUntilTick ?? 0) > before.tick)) {
    assert.equal(house.abandonedTick, undefined);
    assert.ok(house.starvationGraceUntilTick! - RECOVERY_BALANCE.newcomerGraceTicks >= before.tick, "a season's grace from the day they came");
  }
});

test("RC-3 in lord mode a household with bread is not short however thin the town's reserve; in the sandbox it is", () => {
  const fed = (lord: boolean) => {
    const state = shocked(0, lord);
    return { ...state, houses: state.houses.map(house => house.residents > 0 ? { ...house, breadStock: 5 } : house) };
  };
  const shortCount = (state: GameState) => advanceSeasons(state).houses.filter(house => house.foodShortSinceTick !== undefined).length;
  assert.equal(shortCount(fed(true)), 0);
  assert.ok(shortCount(fed(false)) > 0, "the sandbox counts the town's reserve");
  // An empty larder is short in both.
  const hungry = { ...fed(true), houses: fed(true).houses.map((house, index) => index === 0 && house.residents > 0 ? { ...house, breadStock: 0, starvationGraceUntilTick: 0 } : house) };
  assert.ok(shortCount(hungry) >= 1);
});

test("RC-4 the labour shortage pulls harder: unfilled job slots over the slots needed", () => {
  const town = load();
  const staffed = { ...town, buildings: town.buildings.map(building => ({ ...building, workers: Math.max(building.workers, 99) })) };
  assert.equal(labourShortagePermille(staffed), 0);
  assert.equal(migrationPullPermille(staffed), RECOVERY_BALANCE.pullBasePermille);
  const empty = { ...town, buildings: town.buildings.map(building => ({ ...building, workers: 0 })) };
  assert.equal(labourShortagePermille(empty), 1000);
  assert.equal(migrationPullPermille(empty), RECOVERY_BALANCE.pullBasePermille + RECOVERY_BALANCE.pullLabourPermille);
});

test("RC-2 a house never lived in fills by growth, not by newcomers; a burnt or dry house takes none", () => {
  const house = { buildingId: "h", level: 0, residents: 0, hasWater: true, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 };
  assert.equal(vacantForNewcomers(house, 100), false);
  assert.equal(vacantForNewcomers({ ...house, level: 2 }, 100), true);
  assert.equal(vacantForNewcomers({ ...house, level: 2, hasWater: false }, 100), false);
  assert.equal(vacantForNewcomers({ ...house, level: 2, burntTick: 50 }, 100), false);
  assert.equal(vacantForNewcomers({ ...house, level: 2, abandonedTick: 100 - RECOVERY_BALANCE.abandonedWaitTicks + 1 }, 100), false, "the family just left");
});
