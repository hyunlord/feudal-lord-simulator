import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { harvestYieldPermille } from "../src/engine/eventSchedule";
import { gunzipSync } from "node:zlib";

import { ARABLE_CONFIG } from "../src/content/arableConfig";
import { foodEfficiencyMetrics } from "../src/engine/autoplayFoodEfficiency";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { migrateStateV9ToV10 } from "../src/save/migrations/v9ToV10";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";
import { arableLayouts, stripTending } from "../src/zones/arableFields";
import { arableStripStates } from "../src/zones/arableStrips";
import { grainReserveOutlook } from "../src/zones/arableOutlook";
import { cellInsideWall, zonePaintAssessment, zonesOf } from "../src/zones/zoneEdits";
import type { ZoneStroke } from "../src/zones/zone.types";
import { farmsteadAt, fieldWorld, rectangle, runFields } from "./helpers/arableWorld";

/**
 * Bread the four-farm save made in the 24,000 ticks after it was saved, run by the last wheat-farm rules
 * (trunk d823005, the v9 save opened as is): 1,197 bread for 1,242 requested. Measured with the same window sum
 * as below; see docs/verification/c1c2-arable/REPORT.md.
 */
const OLD_RULES_BREAD_24000 = 1197;

function openV9(path: string): { readonly state: GameState; readonly migratedFrom: number } {
  const decoded = decodeSave(new Uint8Array(readFileSync(path)));
  return { state: decoded.envelope.state, migratedFrom: decoded.migratedFrom };
}

test("F5 a v9 save with four wheat farms opens as 16 arable cells and one farmstead, and keeps its bread for 24,000 ticks", () => {
  const { state, migratedFrom } = openV9("fixtures/saves/v9/four-farms.save.json");
  assert.equal(migratedFrom, 9);
  assert.equal(state.buildings.filter(building => building.kind === "wheat_farm").length, 0);
  const fields = zonesOf(state).filter(zone => zone.kind === "arable");
  assert.equal(fields.reduce((sum, zone) => sum + zone.membership.length, 0), 16, "four 2×2 farms are sixteen arable cells");
  assert.equal(state.buildings.filter(building => building.kind === "farmstead").length, 1);
  assert.deepEqual(state.arableMigration, { convertedFarms: 4, farmsteads: 1, unplacedFarmsteads: 0, cellsInsideWall: 0 });
  const tending = stripTending(state);
  assert.ok([...tending.values()].every(entry => entry.status === "tended"), "every converted strip is in a farmstead's reach");

  let current = state;
  let made = 0;
  for (let tick = 1; tick <= 24_000; tick += 1) {
    current = advanceTick(current);
    if (tick % 2400 !== 0) continue;
    const window = foodEfficiencyMetrics(current);
    assert.ok(window.breadProduced > 0, `bread in every 2,400-tick window (tick ${current.tick})`);
    made += window.breadProduced;
  }
  // F0-B (EV-3, EV-5): the old rules had no weather; the harvests in the window bring in their share of the crop, so
  // the old rules' bread is scaled by the mean share of the harvests in the window (seed 2: the 1304 rehearsal −30 %).
  const years = Array.from({ length: 6 }, (_, index) => Math.floor(state.tick / 4000) + 1 + index);
  const share = years.reduce((sum, year) => sum + harvestYieldPermille(state, year * 4000 + 2000), 0) / years.length / 1000;
  assert.ok(made >= OLD_RULES_BREAD_24000 * share * 0.95,
    `bread over 24,000 ticks ${made} ≥ 95% of the old rules' ${OLD_RULES_BREAD_24000} × the harvests' share ${share.toFixed(3)}`);
});

test("F6 the seed-2 walled town (21 wheat farms) migrates to five to seven farmsteads that reach every strip", () => {
  const snapshot = JSON.parse(gunzipSync(readFileSync("docs/verification/c1b-zone-brush/seed2-natural-snapshot.json.gz")).toString()) as GameState;
  assert.equal(snapshot.buildings.filter(building => building.kind === "wheat_farm").length, 21);
  const migrated = migrateStateV9ToV10(snapshot);
  const farmsteads = migrated.buildings.filter(building => building.kind === "farmstead").length;
  assert.ok(farmsteads >= 5 && farmsteads <= 7, `${farmsteads} farmsteads`);
  assert.equal(migrated.arableMigration?.unplacedFarmsteads, 0);
  const tending = stripTending(migrated, arableLayouts(migrated));
  assert.ok(tending.size > 0 && [...tending.values()].every(entry => entry.status === "tended"));
  // The bread ratio with autoplay running is gate ③/F6 evidence (scripts/arableMigrationProof.ts), not a unit test.
});

test("F7 a big field with no granary fills its barn: the harvest waits (창고 넘침), the rest is lost in winter, and spring runs short", () => {
  // 7×5 cells beside the farmstead at (11,8); the barn holds 1,000 and a season gives more.
  const start = fieldWorld({ field: rectangle(4, 8, 11, 13), farmstead: farmsteadAt(11, 8) });
  let sawBarnFull = false;
  const end = runFields(start, ARABLE_CONFIG.winterFrom + 10, state => {
    if (arableStripStates(zonesOf(state)[0]!, state).strips.some(strip => strip.cause === "barn_full")) sawBarnFull = true;
  });
  const barn = end.buildings.find(building => building.kind === "farmstead")!;
  assert.ok(sawBarnFull, "a ripe strip waited for barn space (창고 넘침)");
  assert.ok((barn.inventory.wheat ?? 0) > 1000 - 200, "the barn is (almost) full");
  assert.ok((end.arableFields?.[0]?.lostWheat ?? 0) > 0, "what did not fit was lost when winter came");
  // Twenty-five homes of 32 people eat more wheat before next summer's harvest than one barn holds.
  const hungry = { ...end, houses: Array.from({ length: 25 }, (_, index) => ({ buildingId: `home-${index}`, level: 4 as const, residents: 32,
    hasWater: true, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 })) };
  const outlook = grainReserveOutlook(hungry);
  assert.equal(outlook.short, true, "비축 부족: the store runs out before the next harvest");
  assert.ok(outlook.neededWheat > outlook.storedWheat);
});

test("F9 fields are deterministic and survive a v10 save round trip mid-season", () => {
  const first = runFields(fieldWorld(), 3000);
  const second = runFields(fieldWorld(), 3000);
  assert.deepEqual(first.arableFields, second.arableFields);
  assert.deepEqual(first.buildings, second.buildings);
  const half = runFields(fieldWorld(), 1400);
  const bytes = encodeSave({ state: half, createdAt: "2026-09-25T00:00:00.000Z", savedAt: "2026-09-25T00:00:00.000Z", gameVersion: "test" }).bytes;
  const loaded = decodeSave(bytes);
  assert.equal(loaded.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.ok(SAVE_SCHEMA_VERSION >= 10, "fields are saved since v10 (v11 adds households, LB-10)");
  assert.deepEqual(loaded.envelope.state.arableFields, half.arableFields);
  const resumed = runFields(loaded.envelope.state, 1600);
  assert.deepEqual(resumed.arableFields, first.arableFields);
  assert.deepEqual(resumed.buildings, first.buildings);

  // The whole simulation too: the migrated four-farm town, run 1,200 ticks twice and through a save.
  const town = openV9("fixtures/saves/v9/four-farms.save.json").state;
  const run = (state: GameState, ticks: number) => { let current = state; for (let index = 0; index < ticks; index += 1) current = advanceTick(current); return current; };
  const straight = run(town, 1200);
  assert.deepEqual(run(town, 1200), straight);
  const saved = encodeSave({ state: run(town, 600), createdAt: "2026-09-25T00:00:00.000Z", savedAt: "2026-09-25T00:00:00.000Z", gameVersion: "test" }).bytes;
  assert.deepEqual(JSON.stringify(run(decodeSave(saved).envelope.state, 600)), JSON.stringify(straight));
});

test("F10 arable land is still refused inside the wall, while fields the wall enclosed stay fields", () => {
  const town = JSON.parse(readFileSync("fixtures/zones/town-with-arable.json", "utf8")) as { readonly strokes: { readonly insideArable: ZoneStroke }; readonly state: Partial<GameState> };
  const walled = { ...migrateStateV9ToV10({ ...(town.state as GameState), houses: [], walkers: [], pathCache: {}, zones: [], nextZoneOrdinal: 1 }) };
  const inside = zonePaintAssessment(walled, "arable", town.strokes.insideArable);
  assert.equal(inside.ok, false);
  assert.equal(!inside.ok && inside.reason, "arable_inside_wall");
  assert.equal(gameReducer(walled, { type: "zone_paint", kind: "arable", stroke: town.strokes.insideArable }), walled);
  // The migration kept the farms the wall had already enclosed as fields (AF-1 / AF-12), and they are laid out.
  assert.ok((walled.arableMigration?.cellsInsideWall ?? 0) > 0);
  const enclosed = arableLayouts(walled).flatMap(layout => layout.strips).filter(strip => strip.cells.some(cell => cellInsideWall(walled, cell.ty * walled.width + cell.tx)));
  assert.ok(enclosed.length > 0);
});

test("F8 a new game on autoplay paints arable fields, builds a farmstead and bakes bread within 60,000 ticks", async () => {
  const { createAutoplayTraceDriver } = await import("../scripts/economyHarnessAutoplay");
  const { DEFAULT_GAME_STATE } = await import("../src/state/gameStore");
  const driver = createAutoplayTraceDriver({ id: "c1c2-f8", source: "DEFAULT_GAME_STATE", policy: { maxHousingLots: 24 } });
  let state: GameState = structuredClone(DEFAULT_GAME_STATE);
  let firstField: number | null = null;
  let firstHarvest: number | null = null;
  while (state.tick < 60_000) {
    state = advanceTick(driver.apply(state));
    if (firstField === null && zonesOf(state).some(zone => zone.kind === "arable")) firstField = state.tick;
    if (firstHarvest === null && (state.arableFields ?? []).some(field => field.harvestedWheat > 0)) firstHarvest = state.tick;
  }
  assert.equal(state.settlement?.outcome === "abandoned", false);
  assert.equal(state.buildings.filter(building => building.kind === "wheat_farm").length, 0, "autoplay never builds the retired farm");
  assert.ok(firstField !== null && firstField < 2000, `a field is painted in the first spring (${firstField})`);
  assert.ok(firstHarvest !== null && firstHarvest < 4000, `the first harvest comes in the first year (${firstHarvest})`);
  assert.ok(state.buildings.filter(building => building.kind === "farmstead").length >= 1);
  const window = foodEfficiencyMetrics(state);
  assert.ok(window.breadProduced > 0 && window.breadProduced >= window.requestedBread * 0.9, `bread ${window.breadProduced}/${window.requestedBread}`);
  assert.ok(state.population > DEFAULT_GAME_STATE.population * 10, `the town grew (${state.population})`);
});
