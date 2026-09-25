import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BALANCE } from "../src/content/balanceConfig";
import type { BuildingKind } from "../src/content/buildingConfig";
import { ZONE_UNDO_LIMIT } from "../src/content/zoneConfig";
import { decideNextAction } from "../src/engine/autoplay";
import { zoneRefusesAction } from "../src/engine/autoplayZones";
import type { GameState } from "../src/engine/engine.types";
import { calendar, historicalEra } from "../src/engine/scenarioState";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { zonePaintLines } from "../src/ui/zonePrediction";
import { canPlaceBuilding } from "../src/world/placement";
import { arableStripStates } from "../src/zones/arableStrips";
import { cellInsideWall, zonePaintAssessment, zonesOf } from "../src/zones/zoneEdits";
import { burgageParcels } from "../src/zones/zoneFillAgent";
import { canPlaceBuildingWithZones, zoneMismatches, ZonePlacementFailure } from "../src/zones/zonePlacement";
import type { ZoneStroke } from "../src/zones/zone.types";
import { zonedSeed2State } from "../scripts/zoneAutoplayProof";

const TOWN = JSON.parse(readFileSync("fixtures/zones/town-with-arable.json", "utf8")) as {
  readonly strokes: { readonly outsideArable: ZoneStroke; readonly insideArable: ZoneStroke; readonly outsideBurgage: ZoneStroke };
  readonly state: Partial<GameState>;
};

/** The seed-2 walled town (B2 guardrail final state, trimmed) with no zone. */
function town(): GameState {
  return { ...structuredClone(DEFAULT_GAME_STATE), ...structuredClone(TOWN.state), pathCache: {}, walkers: [], zones: [], nextZoneOrdinal: 1 } as GameState;
}

function spots(state: GameState, kind: BuildingKind) {
  return state.tiles.filter(tile => canPlaceBuilding(state, kind, tile.tx, tile.ty).ok).map(tile => ({ tx: tile.tx, ty: tile.ty }));
}

const brush = (points: readonly [number, number][], radius = 1): ZoneStroke =>
  ({ tool: "brush", radius, points: points.map(([x, y]) => ({ x, y })) });

test("Z-11a gate ①: with only an arable zone every house spot is open; with only a burgage zone every wheat farm spot is open", () => {
  const arableOnly = gameReducer(town(), { type: "zone_paint", kind: "arable", stroke: TOWN.strokes.outsideArable });
  assert.deepEqual(zonesOf(arableOnly).map(zone => zone.kind), ["arable"]);
  const houseSpots = spots(arableOnly, "house");
  assert.ok(houseSpots.length > 0);
  for (const { tx, ty } of houseSpots) assert.deepEqual(canPlaceBuildingWithZones(arableOnly, "house", tx, ty), { ok: true });

  const burgageOnly = gameReducer(town(), { type: "zone_paint", kind: "burgage", stroke: TOWN.strokes.outsideBurgage });
  assert.deepEqual(zonesOf(burgageOnly).map(zone => zone.kind), ["burgage"]);
  // C1c-2: the wheat farm is retired (no spot anywhere); its arable rule now places the farmstead, which needs an
  // arable zone beside it whatever other zones exist (AF-8).
  assert.deepEqual(spots(burgageOnly, "wheat_farm"), []);
  const farmsteadSpots = spots(burgageOnly, "farmstead");
  assert.ok(farmsteadSpots.length > 0);
  for (const { tx, ty } of farmsteadSpots) assert.equal(canPlaceBuildingWithZones(burgageOnly, "farmstead", tx, ty).ok, false);
  // Only the active rule reports mismatches: the town's houses are not "outside" an arable-only zone map.
  assert.ok(zoneMismatches(arableOnly).every(mismatch => mismatch.kind === "wheat_farm"));
  assert.ok(zoneMismatches(burgageOnly).every(mismatch => mismatch.kind === "house"));
  // Pasture, hay meadow, woodland and orchard carry no rule (C5): kind only.
  for (const kind of ["pasture", "hay_meadow", "woodland_common", "orchard"] as const) {
    const painted = gameReducer(town(), { type: "zone_paint", kind, stroke: TOWN.strokes.outsideBurgage });
    assert.equal(zonesOf(painted)[0]?.kind, kind);
    for (const building of ["house", "mill"] as const) {
      const first = spots(painted, building)[0]!;
      assert.deepEqual(canPlaceBuildingWithZones(painted, building, first.tx, first.ty), { ok: true });
    }
  }
});

test("Z-17 gate ②: three strokes, two undone, equal the one-stroke state (zones, plots) and survive a save round trip", () => {
  const base = town();
  const first = gameReducer(base, { type: "zone_paint", kind: "burgage", stroke: TOWN.strokes.outsideBurgage });
  const [zone] = zonesOf(first);
  assert.ok(zone !== undefined);
  // The second stroke touches the first zone and merges into it; the third is a separate arable zone.
  const cell = zone.membership[zone.membership.length - 1]!;
  const edge = { x: (cell % base.width) + 1.5, y: Math.floor(cell / base.width) + 0.5 };
  const second = gameReducer(first, { type: "zone_paint", kind: "burgage", stroke: brush([[edge.x, edge.y], [edge.x + 2, edge.y]]) });
  assert.equal(zonesOf(second).length, 1);
  assert.ok(zonesOf(second)[0]!.membership.length > zone.membership.length, "the second stroke merged into the zone");
  const third = gameReducer(second, { type: "zone_paint", kind: "arable", stroke: TOWN.strokes.outsideArable });
  assert.equal(zonesOf(third).length, 2);

  const undone = gameReducer(gameReducer(third, { type: "zone_undo_stroke" }), { type: "zone_undo_stroke" });
  assert.deepEqual(undone.zones, first.zones);
  assert.equal(undone.nextZoneOrdinal, first.nextZoneOrdinal);
  assert.deepEqual(undone.zoneUndo, first.zoneUndo);
  assert.deepEqual(burgageParcels(undone), burgageParcels(first));

  const bytes = encodeSave({ state: third, createdAt: "2026-09-25T00:00:00.000Z", savedAt: "2026-09-25T00:00:00.000Z", gameVersion: "test" }).bytes;
  const loaded = decodeSave(bytes).envelope.state;
  assert.equal(SAVE_SCHEMA_VERSION, 10);
  assert.deepEqual(loaded.zoneUndo, third.zoneUndo);
  const loadedUndone = gameReducer(gameReducer(loaded, { type: "zone_undo_stroke" }), { type: "zone_undo_stroke" });
  assert.deepEqual(loadedUndone.zones, first.zones);
  assert.deepEqual(burgageParcels(loadedUndone), burgageParcels(first));

  // Undo of the first stroke empties the map; with nothing left to undo the action is a no-op.
  const empty = gameReducer(loadedUndone, { type: "zone_undo_stroke" });
  assert.deepEqual(empty.zones, []);
  assert.equal(empty.nextZoneOrdinal, 1);
  assert.equal(empty.zoneUndo, undefined);
  assert.equal(gameReducer(empty, { type: "zone_undo_stroke" }), empty);
});

test("Z-17 an erase is undone too; removing a zone clears the stack; the stack keeps the last 20 edits", () => {
  const painted = gameReducer(town(), { type: "zone_paint", kind: "burgage", stroke: TOWN.strokes.outsideBurgage });
  const cell = zonesOf(painted)[0]!.membership[0]!;
  const at = { x: (cell % painted.width) + 0.5, y: Math.floor(cell / painted.width) + 0.5 };
  const erased = gameReducer(painted, { type: "zone_erase", stroke: brush([[at.x, at.y], [at.x + 1, at.y]], 1) });
  assert.ok(zonesOf(erased)[0]!.membership.length < zonesOf(painted)[0]!.membership.length);
  assert.deepEqual(gameReducer(erased, { type: "zone_undo_stroke" }).zones, painted.zones);
  const removed = gameReducer(painted, { type: "zone_remove", id: zonesOf(painted)[0]!.id });
  assert.equal(removed.zoneUndo, undefined);

  let many = town();
  for (let index = 0; index < ZONE_UNDO_LIMIT + 5; index += 1) {
    many = gameReducer(many, { type: "zone_paint", kind: index % 2 === 0 ? "pasture" : "orchard", stroke: TOWN.strokes.outsideBurgage });
  }
  assert.equal(many.zoneUndo?.length, ZONE_UNDO_LIMIT);
  const bytes = encodeSave({ state: { ...many, zoneUndo: [...many.zoneUndo!, many.zoneUndo![0]!] }, createdAt: "x", savedAt: "x", gameVersion: "test" }).bytes;
  assert.throws(() => decodeSave(bytes), /zone undo stack/);
});

test("Z-9a an arable stroke across the wall keeps its outside cells and says how many inside cells it left out", () => {
  const state = town();
  const raw = zonePaintAssessment(state, "burgage", TOWN.strokes.insideArable);
  assert.ok(raw.ok);
  const inside = raw.cells.filter(cell => cellInsideWall(state, cell)).length;
  const outside = raw.cells.length - inside;
  const arable = zonePaintAssessment(state, "arable", TOWN.strokes.insideArable);
  if (outside === 0) {
    assert.equal(arable.ok, false, "a stroke wholly inside the wall is still refused");
    return;
  }
  assert.ok(arable.ok);
  assert.equal(arable.cells.length, outside);
  assert.equal(arable.excludedInsideWall, inside);
  assert.ok(arable.cells.every(cell => !cellInsideWall(state, cell)));
  assert.deepEqual(zonePaintLines(state, "arable", TOWN.strokes.insideArable).map(line => [line.severity, line.text]).slice(1),
    [["warn", `성 안 ${inside}칸 제외`]]);
  const painted = gameReducer(state, { type: "zone_paint", kind: "arable", stroke: TOWN.strokes.insideArable });
  assert.deepEqual(zonesOf(painted)[0]!.membership, arable.cells);
});

test("Z-9a a stroke that crosses the wall line keeps exactly the cells outside it", () => {
  const state = town();
  const wall = state.palisade!;
  // Walk from the wall's gate outward and inward: a stroke through the gate point crosses the line.
  const gate = wall.gate;
  const stroke = brush([[gate.x - 3, gate.y], [gate.x + 3, gate.y], [gate.x, gate.y - 3], [gate.x, gate.y + 3]], 1.5);
  const any = zonePaintAssessment(state, "burgage", stroke);
  assert.ok(any.ok);
  const inside = any.cells.filter(cell => cellInsideWall(state, cell)).length;
  assert.ok(inside > 0 && inside < any.cells.length, "the stroke has cells on both sides");
  const arable = zonePaintAssessment(state, "arable", stroke);
  assert.ok(arable.ok);
  assert.equal(arable.excludedInsideWall, inside);
  assert.equal(arable.cells.length, any.cells.length - inside);
});

test("Z-18 / AF-2 arable strip states: strips along the main axis over the zone's open cells, fallow until a farmstead works them", () => {
  const state = gameReducer(town(), { type: "zone_paint", kind: "arable", stroke: TOWN.strokes.outsideArable });
  const zone = zonesOf(state)[0]!;
  const layout = arableStripStates(zone, state);
  assert.deepEqual(arableStripStates(zone, state), layout, "deterministic");
  const cells = layout.strips.flatMap(strip => strip.cells.map(cell => cell.ty * state.width + cell.tx)).sort((a, b) => a - b);
  // AF-1: cells under a road, building or site grow nothing and belong to no strip.
  const open = zone.membership.filter(index => { const tile = state.tiles[index]!; return !tile.hasRoad && tile.buildingId === null
    && (tile.terrain === "grass" || tile.terrain === "forest"); });
  assert.deepEqual(cells, open, "the strips cover the zone's open cells exactly once");
  for (const strip of layout.strips) {
    const lines = new Set(strip.cells.map(cell => layout.axis === "x" ? cell.ty : cell.tx));
    assert.equal(lines.size, 1, "a strip lies on one line along the main axis");
    assert.equal(strip.stage, "fallow");
    assert.equal(strip.state, "fallow");
    assert.equal(strip.crop, "wheat");
    assert.ok(strip.yieldEstimate > 0);
  }
});

test("calendar: a provisional 4,000-tick year of four 1,000-tick seasons; era years unchanged", () => {
  assert.equal(BALANCE.TICKS_PER_YEAR, 4000);
  assert.deepEqual(calendar(999, 1300), { year: 1300, season: 0, dayOfYear: 90 });
  assert.deepEqual(calendar(1000, 1300), { year: 1300, season: 1, dayOfYear: 91 });
  assert.deepEqual(calendar(4000, 1300), { year: 1301, season: 0, dayOfYear: 1 });
  const eraAt = (year: number) => historicalEra({ tick: (year - 1300) * 4000, scenarioId: "core:campaign_market_town" }).id;
  assert.deepEqual([1314, 1315, 1337, 1348, 1380].map(eraAt), ["saturation", "famine", "war", "collapse", "specialisation"]);
  // Autoplay's 24-lot victories (277k–628k ticks, C2 guardrail) now land in 1369–1457.
  assert.deepEqual([277_437, 628_273].map(tick => calendar(tick, 1300).year), [1369, 1457]);
});

test("Z-15a in the zoned seed-2 town the autoplay fills a plot and never proposes a zone-refused placement", () => {
  const state = zonedSeed2State();
  const action = decideNextAction(state, { maxHousingLots: 32 });
  assert.equal(zoneRefusesAction(state, action), false);
  assert.equal(action.kind, "place_building");
  if (action.kind !== "place_building") return;
  assert.equal(action.building, "house");
  const plots = burgageParcels(state);
  assert.ok(plots.some(parcel => parcel.cells.some(cell => cell.tx === action.tx && cell.ty === action.ty)), "the house goes onto a plot");
  // At the policy's lot cap the agent adds no house, and nothing else it proposes is refused by a zone rule.
  const capped = decideNextAction(state, { maxHousingLots: 24 });
  assert.equal(zoneRefusesAction(state, capped), false);
  assert.ok(capped.kind !== "place_building" || capped.building !== "house");
  assert.equal(ZonePlacementFailure.outside_zone, "outside_zone");
});
