import assert from "node:assert/strict";
import test from "node:test";

import { ARABLE_CONFIG } from "../src/content/arableConfig";
import { BALANCE } from "../src/content/balanceConfig";
import { arableSupplyShort } from "../src/engine/autoplayArable";
import { measuredFoodDecision } from "../src/engine/autoplayFoodMeasuredDecision";
import type { GameState } from "../src/engine/engine.types";
import { runProduction } from "../src/engine/simulationProduction";
import { expectedAnnualWheat, HARVEST_RECORD_YEARS, nextHarvestRecord, realisedAnnualWheat, realisedHarvestPermille } from "../src/zones/arableOutlook";
import { observedFoodTown, replayFoodObservation } from "./foodEfficiencyObservationFixture";
import { fieldWorld } from "./helpers/arableWorld";
import { withAmpleGrain } from "./helpers/autoplayFoodFixtures";

const YEAR = BALANCE.TICKS_PER_YEAR;

test("GP-1 the record takes the year's expected harvest at its first harvest and adds each harvest's wheat", () => {
  const world = fieldWorld({ tick: 5 * YEAR + 1500 });
  assert.equal(nextHarvestRecord(world, 0), undefined, "no harvest, no record");
  const first = nextHarvestRecord(world, 12)!;
  assert.deepEqual(first, { year: 5, wheat: 12, past: [], expected: expectedAnnualWheat(world) });
  assert.ok(first.expected! > 0);
  const second = nextHarvestRecord({ ...world, tick: world.tick + 10, harvestRecord: first }, 8)!;
  assert.equal(second.wheat, 20);
  assert.equal(second.expected, first.expected, "taken once a year");
  const quiet = { ...world, tick: world.tick + 20, harvestRecord: second };
  assert.equal(nextHarvestRecord(quiet, 0), second, "an unchanged record keeps its reference");
});

test("GP-1 a new calendar year moves the counted year into the past, keeps three and skips a year without a harvest", () => {
  const world = fieldWorld({ tick: 9 * YEAR });
  const record = { year: 8, expected: 100, wheat: 70, past: [{ expected: 100, wheat: 90 }, { expected: 100, wheat: 80 }, { expected: 100, wheat: 60 }] };
  const rolled = nextHarvestRecord({ ...world, harvestRecord: record }, 0)!;
  assert.deepEqual(rolled, { year: 9, wheat: 0, past: [{ expected: 100, wheat: 80 }, { expected: 100, wheat: 60 }, { expected: 100, wheat: 70 }] });
  assert.equal(rolled.past.length, HARVEST_RECORD_YEARS);
  const barren = nextHarvestRecord({ ...world, tick: 10 * YEAR, harvestRecord: rolled }, 0)!;
  assert.deepEqual(barren.past, rolled.past, "a year with no harvest has no expected harvest and is not kept");
});

test("GP-1 the simulation records a year's harvest: the barn's wheat against the expected harvest", () => {
  let state: GameState = fieldWorld();
  const expected = expectedAnnualWheat(state);
  for (let tick = 0; tick < YEAR + 10; tick += 1) state = { ...runProduction(state), tick: state.tick + 1 };
  const record = state.harvestRecord!;
  assert.equal(record.year, 1);
  assert.equal(record.past.length, 1);
  assert.equal(record.past[0]!.expected, expected);
  assert.ok(record.past[0]!.wheat > 0 && record.past[0]!.wheat <= expected, `${record.past[0]!.wheat} of ${expected}`);
  assert.ok(ARABLE_CONFIG.growTicks < YEAR);
});

test("GP-2 the realised share is Σ harvested ÷ Σ expected over the kept years, at most one, one with no record", () => {
  assert.equal(realisedHarvestPermille({}), 1000);
  assert.equal(realisedHarvestPermille({ harvestRecord: { year: 3, wheat: 0, past: [{ expected: 1000, wheat: 700 }, { expected: 1000, wheat: 800 }] } }), 750);
  assert.equal(realisedHarvestPermille({ harvestRecord: { year: 3, wheat: 0, past: [{ expected: 1000, wheat: 1400 }] } }), 1000);
  const world = fieldWorld();
  const halved = { ...world, harvestRecord: { year: 0, wheat: 0, past: [{ expected: 2000, wheat: 1000 }] } };
  assert.equal(realisedAnnualWheat(halved), Math.floor(expectedAnnualWheat(world) / 2));
});

test("GP-2 the grain step judges the shortage by the realised harvest: an ample expectation that the barns never took in is short", () => {
  const ample = replayFoodObservation(withAmpleGrain(observedFoodTown()), { wheat: 1000, bread: 40, exports: 0 });
  assert.equal(arableSupplyShort(ample), false, "the expected harvest alone is ample");
  const poor = { ...ample, harvestRecord: { year: 0, wheat: 0, past: [{ expected: 10_000, wheat: 100 }, { expected: 10_000, wheat: 200 }] } };
  assert.equal(realisedHarvestPermille(poor), 15);
  assert.equal(arableSupplyShort(poor), true);
  const full = { ...ample, harvestRecord: { year: 0, wheat: 0, past: [{ expected: 10_000, wheat: 10_000 }] } };
  assert.equal(arableSupplyShort(full), false);
});

function starvedMills(inventory: (kind: string) => Record<string, number>): GameState {
  const base = replayFoodObservation(withAmpleGrain(observedFoodTown()), { wheat: 1000, bread: 40, exports: 0 }, 2400);
  return { ...base, buildings: base.buildings.map(b => ["farmstead", "mill", "granary"].includes(b.kind) ? { ...b, inventory: inventory(b.kind) } : b) };
}

test("GP-3 starving mills with no cart-load of wheat anywhere and a reserve that will not reach the harvest: more fields", () => {
  const empty = starvedMills(() => ({}));
  assert.deepEqual(measuredFoodDecision(empty), { kind: "farmstead", reason: "grain_exhausted" });
});

test("GP-3 starving mills with no wheat but bread enough until the harvest: nothing to build, not a hauling problem", () => {
  const stocked = starvedMills(kind => kind === "granary" ? { bread: 5_000 } : {});
  assert.deepEqual(measuredFoodDecision(stocked), { kind: null, reason: "grain_between_harvests" });
});

test("GP-3 starving mills while a cart-load of wheat waits somewhere is still a hauling problem", () => {
  const waiting = starvedMills(kind => kind === "farmstead" ? { wheat: BALANCE.CARTER_CAPACITY } : {});
  assert.deepEqual(measuredFoodDecision(waiting), { kind: null, reason: "wheat_transport_blocked" });
});
