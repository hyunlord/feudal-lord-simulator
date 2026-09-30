import assert from "node:assert/strict";
import test from "node:test";

import { ARABLE_CONFIG } from "../src/content/arableConfig";
import { BALANCE } from "../src/content/balanceConfig";
import { arableSupplyShort } from "../src/engine/autoplayArable";
import { measuredFoodDecision } from "../src/engine/autoplayFoodMeasuredDecision";
import type { GameState } from "../src/engine/engine.types";
import { runProduction } from "../src/engine/simulationProduction";
import { expectedAnnualWheat, HARVEST_RECORD_YEARS, nextHarvestRecord, realisedAnnualWheat, realisedHarvestPermille, sownExpectedWheat } from "../src/zones/arableOutlook";
import { observedFoodTown, replayFoodObservation } from "./foodEfficiencyObservationFixture";
import { fieldWorld } from "./helpers/arableWorld";
import { withAmpleGrain } from "./helpers/autoplayFoodFixtures";

const YEAR = BALANCE.TICKS_PER_YEAR;

test("GP-1 the record takes the year's expected harvest at its first harvest and adds each harvest's wheat", () => {
  const world = fieldWorld({ tick: 5 * YEAR + 1500 });
  assert.equal(nextHarvestRecord(world, 0), undefined, "no harvest, no record");
  const first = nextHarvestRecord(world, 12)!;
  assert.deepEqual(first, { year: 5, wheat: 12, lost: 0, past: [], expected: sownExpectedWheat(world) });
  assert.equal(first.expected, 0, "a field painted but never sown this year is not this year's crop");
  assert.ok(expectedAnnualWheat(world) > 0);
  const second = nextHarvestRecord({ ...world, tick: world.tick + 10, harvestRecord: first }, 8)!;
  assert.equal(second.wheat, 20);
  assert.equal(second.expected, first.expected, "taken once a year");
  const quiet = { ...world, tick: world.tick + 20, harvestRecord: second };
  assert.equal(nextHarvestRecord(quiet, 0), second, "an unchanged record keeps its reference");
});

test("GP-1 a new calendar year moves the counted year into the past, keeps three and skips a year without a harvest", () => {
  const world = fieldWorld({ tick: 9 * YEAR });
  const record = { year: 8, expected: 100, wheat: 70, lost: 5, past: [{ expected: 100, wheat: 90, lost: 0 }, { expected: 100, wheat: 80, lost: 0 }, { expected: 100, wheat: 60, lost: 0 }] };
  const rolled = nextHarvestRecord({ ...world, harvestRecord: record }, 0)!;
  assert.deepEqual(rolled, { year: 9, wheat: 0, lost: 0, past: [{ expected: 100, wheat: 80, lost: 0 }, { expected: 100, wheat: 60, lost: 0 }, { expected: 100, wheat: 70, lost: 5 }] });
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
  const years = (...wheat: number[]) => wheat.map(amount => ({ expected: 1000, wheat: amount, lost: 0 }));
  assert.equal(realisedHarvestPermille({ harvestRecord: { year: 3, wheat: 0, lost: 0, past: years(700, 800, 750) } }), 750);
  assert.equal(realisedHarvestPermille({ harvestRecord: { year: 3, wheat: 0, lost: 0, past: years(700, 800) } }), 1000, "fewer than three kept years: not read");
  assert.equal(realisedHarvestPermille({ harvestRecord: { year: 3, wheat: 0, lost: 0, past: years(1400, 1400, 1400) } }), 1000);
  const world = fieldWorld();
  const halved = { ...world, harvestRecord: { year: 0, wheat: 0, lost: 0, past: years(500, 500, 500) } };
  assert.equal(realisedAnnualWheat(halved), Math.floor(expectedAnnualWheat(world) / 2));
});

test("GP-2 the grain step judges the shortage by the realised harvest: an ample expectation that the barns never took in is short", () => {
  const ample = replayFoodObservation(withAmpleGrain(observedFoodTown()), { wheat: 1000, bread: 40, exports: 0 });
  assert.equal(arableSupplyShort(ample), false, "the expected harvest alone is ample");
  const poor = { ...ample, harvestRecord: { year: 0, wheat: 0, lost: 0, past: [{ expected: 10_000, wheat: 100, lost: 0 }, { expected: 10_000, wheat: 200, lost: 0 }, { expected: 10_000, wheat: 150, lost: 0 }] } };
  assert.equal(realisedHarvestPermille(poor), 15);
  assert.equal(arableSupplyShort(poor), true);
  const full = { ...ample, harvestRecord: { year: 0, wheat: 0, lost: 0, past: [{ expected: 10_000, wheat: 10_000, lost: 0 }, { expected: 10_000, wheat: 10_000, lost: 0 }, { expected: 10_000, wheat: 10_000, lost: 0 }] } };
  assert.equal(arableSupplyShort(full), false);
});

test("GP-2 ripe wheat left in the field because the barns were full counts as grown: a harvesting limit is not the land's", () => {
  const ample = replayFoodObservation(withAmpleGrain(observedFoodTown()), { wheat: 1000, bread: 40, exports: 0 });
  const backedUp = { ...ample, harvestRecord: { year: 0, wheat: 0, lost: 0, past: [{ expected: 10_000, wheat: 6_000, lost: 3_500 }, { expected: 10_000, wheat: 6_000, lost: 3_500 }, { expected: 10_000, wheat: 6_000, lost: 3_500 }] } };
  assert.equal(realisedHarvestPermille(backedUp), 950);
  assert.equal(arableSupplyShort(backedUp), false);
  const world = fieldWorld({ tick: 3 * YEAR + 3000 });
  const counted = { ...world, harvestRecord: { year: 3, expected: 500, wheat: 300, lost: 0, past: [] } };
  assert.equal(nextHarvestRecord(counted, 0, 40)!.lost, 40, "winter's loss is added to the counted year");
  assert.equal(nextHarvestRecord({ ...world, harvestRecord: { year: 3, wheat: 0, lost: 0, past: [] } }, 0, 40)!.lost, 0, "a year with no harvest keeps no loss");
});

function starvedMills(inventory: (kind: string) => Record<string, number>): GameState {
  const base = replayFoodObservation(withAmpleGrain(observedFoodTown()), { wheat: 1000, bread: 40, exports: 0 }, 2400);
  return { ...base, buildings: base.buildings.map(b => ["farmstead", "mill", "granary"].includes(b.kind) ? { ...b, inventory: inventory(b.kind) } : b) };
}

test("GP-3 starving mills with no cart-load of wheat anywhere after years whose fields grew too little: more fields", () => {
  const empty = { ...starvedMills(() => ({})), harvestRecord: { year: 0, wheat: 0, lost: 0, past: [{ expected: 10_000, wheat: 100, lost: 0 }, { expected: 10_000, wheat: 100, lost: 0 }, { expected: 10_000, wheat: 100, lost: 0 }] } };
  assert.deepEqual(measuredFoodDecision(empty), { kind: "farmstead", reason: "actual_wheat_deficit" }, "the grain step (GP-2) sees it first");
  assert.deepEqual(measuredFoodDecision(empty, { ignoreGrain: true }), { kind: "farmstead", reason: "grain_exhausted" });
});

test("GP-3 starving mills with no wheat and no year that grew too little: between harvests, nothing to build, not a hauling problem", () => {
  assert.deepEqual(measuredFoodDecision(starvedMills(() => ({}))), { kind: null, reason: "grain_between_harvests" });
  const grown = { ...starvedMills(() => ({})), harvestRecord: { year: 0, wheat: 0, lost: 0, past: [{ expected: 10_000, wheat: 7_000, lost: 3_000 }] } };
  assert.deepEqual(measuredFoodDecision(grown), { kind: null, reason: "grain_between_harvests" });
});

test("GP-3 mills short of wheat now but not starving over the window: the old rules decide", () => {
  const base = replayFoodObservation(withAmpleGrain(observedFoodTown()), { wheat: 1000, bread: 40, exports: 0 }, 0);
  const idle = { ...base, buildings: base.buildings.map(b => ["farmstead", "mill", "granary"].includes(b.kind) ? { ...b, inventory: {} } : b) };
  assert.notEqual(measuredFoodDecision(idle).reason, "grain_between_harvests");
  assert.notEqual(measuredFoodDecision(idle).reason, "grain_exhausted");
});

test("GP-3 starving mills while a cart-load of wheat waits somewhere is still a hauling problem", () => {
  const waiting = starvedMills(kind => kind === "farmstead" ? { wheat: BALANCE.CARTER_CAPACITY } : {});
  assert.deepEqual(measuredFoodDecision(waiting), { kind: null, reason: "wheat_transport_blocked" });
});
