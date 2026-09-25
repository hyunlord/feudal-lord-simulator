import assert from "node:assert/strict";
import test from "node:test";

import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import { householdMembers } from "../src/population/householdMembers";
import { OCCUPATION_BANDS, walkerLook, walkerLooks, walkerSheet } from "../src/render/walkerLook";
import { walkerSheetManifest } from "../src/render/walkerSheetManifest.generated";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { withResidentWalkers } from "../src/state/residentWalkerState";
import { absoluteDay, dayStartTick, isMarketDay, isResidentWalker, MARKET_DAY_OF_MONTH, RESIDENT_WALKER_CAP, residentWalkers, VISITOR_REACH,
  type ResidentOccupation } from "../src/ui/residentTrips";
import { hashEconomyState } from "../scripts/economyHarnessSerializer";
import { loadSeed2City } from "../scripts/walkerLookEvidence";

// MOVE-1 (spec docs/design/resident-movement.md RM-1..RM-7). Scene: the C3 seed 2 city (V2's evidence town).

function yearSamples(every: number, count: number): GameState[] {
  let state = loadSeed2City();
  const samples: GameState[] = [];
  for (let index = 0; index < count * every; index += 1) {
    state = advanceTick(state);
    if (index % every === 0) samples.push(state);
  }
  return samples;
}

const SAMPLES = yearSamples(100, 40);

test("RM-6 residents are presentation only: deriving them never changes the state or its next tick", () => {
  const state = SAMPLES[10]!;
  const before = hashEconomyState(state);
  const plainNext = hashEconomyState(advanceTick(structuredClone(state)));
  assert.ok(residentWalkers(state).length > 0);
  const display = withResidentWalkers(state);
  assert.equal(hashEconomyState(state), before, "the simulation state is untouched");
  assert.equal(state.walkers.every(walker => !isResidentWalker(walker)), true);
  assert.equal(hashEconomyState(advanceTick(state)), plainNext, "the next tick is the same with or without residents derived");
  assert.equal(display.walkers.length, state.walkers.length + residentWalkers(state).length);
});

test("RM-7 determinism: the same state at the same tick gives the same residents, after a clone and a save round trip", () => {
  for (const state of SAMPLES.filter((_, index) => index % 4 === 0)) {
    const walkers = JSON.stringify(residentWalkers(state));
    assert.equal(JSON.stringify(residentWalkers(structuredClone(state))), walkers);
    const saved = decodeSave(encodeSave({ state, createdAt: "2026-09-25T00:00:00.000Z", savedAt: "2026-09-25T00:00:00.000Z" }).bytes).envelope.state as GameState;
    assert.equal(JSON.stringify(residentWalkers(saved)), walkers);
    const looks = JSON.stringify([...walkerLooks(withResidentWalkers(state))]);
    assert.equal(JSON.stringify([...walkerLooks(withResidentWalkers(saved))]), looks);
  }
});

test("RM-1 a household walker's tag is one of its house's adults, and the drawn body has that member's sex", () => {
  let household = 0;
  for (const state of SAMPLES) {
    for (const walker of residentWalkers(state)) {
      const tag = walker.resident;
      assert.equal(walkerLook(state, walker).sex, tag.sex, `${walker.id} is drawn as its tagged sex`);
      if (tag.houseId === null) continue;
      household += 1;
      const member = householdMembers(state, tag.houseId)?.members[tag.memberIndex ?? -1];
      assert.ok(member !== undefined && member.ageBand !== "child");
      assert.deepEqual({ sex: member.sex, ageBand: member.ageBand }, { sex: tag.sex, ageBand: tag.ageBand });
      assert.equal(walker.homeBuildingId, tag.houseId);
    }
  }
  assert.ok(household > 50);
});

test("RM-2..RM-5 the year has every purpose, visitors on market days, at most 40 at once, on roads, never carrying", () => {
  const purposes = new Set<string>();
  let visitorsOnMarketDays = 0;
  for (const state of SAMPLES) {
    const walkers = residentWalkers(state);
    assert.ok(walkers.length <= RESIDENT_WALKER_CAP);
    for (const walker of walkers) {
      purposes.add(walker.resident.purpose);
      assert.equal(walker.cargo, null);
      const from = walker.path[walker.pathIndex]!;
      assert.equal(state.tiles[from.ty * state.width + from.tx]?.hasRoad, true, `${walker.id} walks on a road`);
    }
    // F0-A pulse: the market is monthly and a day is 11 ticks, so count visitors within 300 ticks of a market day's start.
    const day = absoluteDay(state.tick);
    const marketStart = dayStartTick(day - ((((day - MARKET_DAY_OF_MONTH) % 30) + 30) % 30));
    if (state.tick - marketStart < 300 && walkers.some(walker => walker.resident.purpose === "visit")) visitorsOnMarketDays += 1;
  }
  assert.deepEqual([...purposes].sort(), ["church", "clergy", "field", "market", "patrol", "visit", "well"]);
  assert.ok(visitorsOnMarketDays > 0, "visitors walk on market days");
});

test("RM-4 guards wear the guard sheet (male legacy art) and clergy the clergy bands", () => {
  const guards = SAMPLES.flatMap(state => residentWalkers(state).filter(walker => walker.resident.purpose === "patrol").map(walker => walkerLook(state, walker)));
  assert.ok(guards.length > 0);
  assert.ok(guards.every(look => look.sheetId === "legacy_guard" && look.sex === "male"));
  const clergy = SAMPLES.flatMap(state => residentWalkers(state).filter(walker => walker.resident.purpose === "clergy").map(walker => walkerLook(state, walker)));
  assert.ok(clergy.length > 0 && clergy.every(look => ["priest", "monk", "nun"].includes(look.band)));
});

test("V2 mapping: every installed class band has a walking occupation, and every resident occupation draws from both sexes", () => {
  const bands = new Set(walkerSheetManifest.filter(sheet => !["legacy_civilian_man", "legacy_civilian_woman", "legacy_merchant", "legacy_cleric"].includes(sheet.id))
    .map(sheet => sheet.classBand));
  const mapped = new Set(Object.values(OCCUPATION_BANDS).flatMap(rows => rows.map(([band]) => band)));
  assert.deepEqual([...bands].filter(band => !mapped.has(band)), []);
  const residentOccupations: readonly ResidentOccupation[] = ["water_fetcher", "marketgoer", "churchgoer", "field_hand", "market_visitor", "clergy"];
  for (const occupation of residentOccupations) {
    for (const sex of ["female", "male"] as const) {
      assert.ok(walkerSheetManifest.some(sheet => sheet.sex === sex && !sheet.legacy && OCCUPATION_BANDS[occupation].some(([band]) => band === sheet.classBand)),
        `${occupation} has a ${sex} sheet`);
    }
  }
  assert.equal(walkerSheet("legacy_guard").classBand, "guard");
});

test("RM-2 (F0-A pulse) the market is monthly and its visitors are on the road only within 300 ticks of the market day", () => {
  let state = loadSeed2City();
  let marketDays = 0;
  let visitorTicks = 0;
  const visitorsAt: { tick: number; count: number; sinceMarket: number }[] = [];
  for (let step = 0; step < 4_000; step += 1) {
    state = advanceTick(state);
    if (step % 10 !== 0) continue;
    const day = absoluteDay(state.tick);
    const lastMarket = day - ((day - MARKET_DAY_OF_MONTH) % 30 + 30) % 30;
    const visitors = residentWalkers(state).filter(walker => walker.resident.purpose === "visit");
    if (visitors.length > 0) {
      visitorTicks += 1;
      visitorsAt.push({ tick: state.tick, count: visitors.length, sinceMarket: state.tick - dayStartTick(lastMarket) });
      for (const walker of visitors) assert.ok(walker.path.length - 1 <= VISITOR_REACH, `${walker.id} walks at most ${VISITOR_REACH} road steps`);
    }
  }
  for (let day = 0; day < 360; day += 1) if (isMarketDay(dayStartTick(day))) marketDays += 1;
  assert.equal(marketDays, 12, "twelve market days a year");
  assert.ok(visitorTicks > 0, "visitors come on market days");
  assert.ok(visitorsAt.every(sample => sample.sinceMarket >= 0 && sample.sinceMarket < 300), "no visitor outside 300 ticks after a market day starts");
  const months = new Set(visitorsAt.map(sample => Math.floor((sample.tick - dayStartTick(MARKET_DAY_OF_MONTH)) / (4_000 / 12))));
  assert.ok(months.size >= 10, `visitors in ${months.size} of 12 months`);
});
