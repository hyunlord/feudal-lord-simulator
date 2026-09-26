import assert from "node:assert/strict";
import { migrateStateV15ToV16 } from "../src/save/migrations/v15ToV16";
import { migrateStateV10ToV11 } from "../src/save/migrations/v10ToV11";
import { migrateStateV11ToV12 } from "../src/save/migrations/v11ToV12";
import { migrateStateV9ToV10 } from "../src/save/migrations/v9ToV10";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { placeBuilding, placeRoadLine } from "../src/engine/gameActions";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { zoneMismatches } from "../src/zones/zonePlacement";
import { zoneAt, zonesOf } from "../src/zones/zoneEdits";
import {
  interiorPlacementTiles,
  normalizeZoneStroke,
  rasterizeZoneStroke,
  rasterizeZoneStrokes,
  type ZoneGrid,
} from "../src/zones/zoneRaster";
import type { ZoneKind, ZoneStroke } from "../src/zones/zone.types";
import { canonicalStateHash } from "../scripts/verifySaveDeterminism";

function grassGrid(width: number, height: number, water: readonly number[] = []): ZoneGrid & Pick<GameState, "tiles"> {
  return {
    width,
    height,
    tiles: Array.from({ length: width * height }, (_, index) => ({
      tx: index % width, ty: Math.floor(index / width), terrain: water.includes(index) ? "water" as const : "grass" as const,
      buildingId: null, hasRoad: false,
    })) as GameState["tiles"],
  };
}

/** A new game on an open 16×16 grass field: the smallest GameState the zone actions run on. */
function openField(): GameState {
  const grid = grassGrid(16, 16);
  return { ...structuredClone(DEFAULT_GAME_STATE), width: 16, height: 16, tiles: grid.tiles, buildings: [], houses: [], constructionSites: [] };
}

const square = (x0: number, y0: number, x1: number, y1: number): ZoneStroke =>
  ({ tool: "polygon", points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });

const paint = (state: GameState, kind: ZoneKind, stroke: ZoneStroke) => gameReducer(state, { type: "zone_paint", kind, stroke });

test("Z-1 a new game and every migrated save start with no zone and ordinal 1", () => {
  assert.deepEqual(DEFAULT_GAME_STATE.zones, []);
  assert.equal(DEFAULT_GAME_STATE.nextZoneOrdinal, 1);
  assert.ok(SAVE_SCHEMA_VERSION >= 6);
  const v5 = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v5/population-176.save.json")));
  assert.equal(v5.migratedFrom, 5);
  // No zone survives from before v6; v10 paints only the converted wheat farms' fields (arable).
  assert.ok((v5.envelope.state.zones ?? []).every(zone => zone.kind === "arable"));
  assert.equal(v5.envelope.state.nextZoneOrdinal, (v5.envelope.state.zones ?? []).length + 1);
  const original = JSON.parse(readFileSync("fixtures/saves/v5/population-176.save.json", "utf8")).state;
  const { coinLedger: _coinLedger, ...originalRest } = original;
  // v6 -> v7 (B3) then swaps the income window for a ledger holding the opening balance.
  // v9 -> v10 (C1c-2) then turns the wheat farms into arable fields and farmsteads (spec AF-12); v10 -> v11 adds households; v11 -> v12 opens the season and enters the due eras (FP-1, FP-5).
  assert.deepEqual(v5.envelope.state, migrateStateV15ToV16(migrateStateV11ToV12(migrateStateV10ToV11(migrateStateV9ToV10({ ...originalRest, zones: [], nextZoneOrdinal: 1, ledger: { entries: [{ id: "ledger-000001", tick: original.tick, account: "cash", category: "opening_balance", amount: original.treasuryCoin,
    sourceRefs: [{ type: "scenario", id: "core:campaign_market_town", detail: "save_v6" }] }], rollups: [], nextEntryOrdinal: 2 } })))));
});

test("Z-1 empty zones do not change the simulation: a migrated save runs 1,200 ticks to the same state", () => {
  // A save without wheat farms: v10 paints fields only where old farms stood (AF-12), so its zones stay empty.
  const { envelope } = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v5/new-game.save.json")));
  const { zones: _zones, nextZoneOrdinal: _ordinal, ...withoutZones } = envelope.state;
  let migrated: GameState = envelope.state;
  let bare: GameState = withoutZones;
  for (let tick = 0; tick < 1_200; tick += 1) {
    migrated = advanceTick(migrated);
    bare = advanceTick(bare);
  }
  const { zones, nextZoneOrdinal, ...migratedRest } = migrated;
  assert.deepEqual(zones, []);
  assert.equal(nextZoneOrdinal, 1);
  assert.equal(canonicalStateHash(migratedRest), canonicalStateHash(bare));
});

test("Z-1 a zoned v6 save round-trips and the codec rejects impossible zones", () => {
  const bytes = new Uint8Array(readFileSync("fixtures/saves/v6/zoned-opening.save.json"));
  const { envelope } = decodeSave(bytes);
  assert.equal(envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(zonesOf(envelope.state).length, 2);
  const again = decodeSave(encodeSave({ state: envelope.state, createdAt: envelope.createdAt, savedAt: envelope.savedAt, gameVersion: envelope.gameVersion }).bytes);
  assert.deepEqual(again.envelope.state, envelope.state);
  const [first, second] = zonesOf(envelope.state);
  const corrupt = (zones: unknown) => encodeSave({ state: { ...envelope.state, zones } as GameState, createdAt: envelope.createdAt, savedAt: envelope.savedAt, gameVersion: envelope.gameVersion }).bytes;
  assert.throws(() => decodeSave(corrupt([first, { ...second!, membership: [first!.membership[0]!, ...second!.membership] }])), /belongs to two zones/);
  assert.throws(() => decodeSave(corrupt([{ ...first!, kind: "vineyard" }])), /kind is unknown/);
  assert.throws(() => decodeSave(corrupt([{ ...first!, strokes: [{ tool: "brush", radius: 1.3, points: [{ x: 1.01, y: 2 }] }] }])), /snapped stroke/);
  assert.throws(() => decodeSave(corrupt([{ ...first!, membership: [...first!.membership].reverse() }])), /ascending/);
});

test("Z-2 strokes snap to 1/8 tile and out-of-limit strokes are ignored", () => {
  assert.deepEqual(normalizeZoneStroke({ tool: "brush", radius: 1.3, points: [{ x: 1.01, y: 2.07 }] }),
    { tool: "brush", radius: 1.25, points: [{ x: 1, y: 2.125 }] });
  for (const stroke of [
    { tool: "brush", radius: 0.2, points: [{ x: 1, y: 1 }] },
    { tool: "brush", points: [{ x: 1, y: 1 }] },
    { tool: "polygon", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
    { tool: "brush", radius: 1, points: [{ x: Number.NaN, y: 1 }] },
    { tool: "spray", radius: 1, points: [{ x: 1, y: 1 }] },
  ] as unknown as ZoneStroke[]) {
    assert.equal(normalizeZoneStroke(stroke), null);
    const state = openField();
    assert.equal(paint(state, "burgage", stroke), state);
  }
});

test("Z-3 membership is decided by cell centres: closed brush discs, polygons, no water", () => {
  const grid = grassGrid(8, 8, [8 * 5 + 5]);
  // Cell centres sit at (tx+0.5, ty+0.5): radius 1 around a cell centre reaches the four edge neighbours exactly.
  assert.deepEqual(rasterizeZoneStroke({ tool: "brush", radius: 1, points: [{ x: 3.5, y: 3.5 }] }, grid), [19, 26, 27, 28, 35]);
  assert.deepEqual(rasterizeZoneStroke({ tool: "brush", radius: 0.5, points: [{ x: 3.5, y: 3.5 }] }, grid), [27]);
  // Between four centres: all four are √0.5 away.
  assert.deepEqual(rasterizeZoneStroke({ tool: "brush", radius: 1, points: [{ x: 4, y: 4 }] }, grid), [27, 28, 35, 36]);
  // A swept brush covers the whole segment, not only its end points.
  assert.deepEqual(rasterizeZoneStroke({ tool: "brush", radius: 0.5, points: [{ x: 0.5, y: 0.5 }, { x: 4.5, y: 0.5 }] }, grid), [0, 1, 2, 3, 4]);
  // Polygon over cells 4..6 × 4..6; (5,5) is water.
  assert.deepEqual(rasterizeZoneStroke(square(4, 4, 7, 7), grid), [36, 37, 38, 44, 46, 52, 53, 54]);
  // Roads and buildings stay members.
  const roaded = { ...grid, tiles: grid.tiles.map((tile, index) => (index === 36 ? { ...tile, hasRoad: true, buildingId: "x" } : tile)) };
  assert.deepEqual(rasterizeZoneStroke(square(4, 4, 7, 7), roaded), rasterizeZoneStroke(square(4, 4, 7, 7), grid));
});

test("Z-4 membership ignores stroke order and polygon vertex order, even with vertices on cell centres", () => {
  const grid = grassGrid(20, 20);
  const polygon: ZoneStroke = { tool: "polygon", points: [{ x: 2.5, y: 2.5 }, { x: 9.5, y: 4.5 }, { x: 12.5, y: 11.5 }, { x: 6.5, y: 13.5 }, { x: 1.5, y: 8.5 }] };
  const reversed: ZoneStroke = { ...polygon, points: [...polygon.points].reverse() };
  const rotated: ZoneStroke = { ...polygon, points: [...polygon.points.slice(2), ...polygon.points.slice(0, 2)] };
  const brush: ZoneStroke = { tool: "brush", radius: 1.5, points: [{ x: 10, y: 15 }, { x: 16, y: 12 }, { x: 18, y: 17.5 }] };
  const brushReversed: ZoneStroke = { ...brush, points: [...brush.points].reverse() };
  const expected = rasterizeZoneStrokes([polygon, brush], grid);
  assert.deepEqual(rasterizeZoneStrokes([brush, polygon], grid), expected);
  assert.deepEqual(rasterizeZoneStrokes([reversed, brushReversed], grid), expected);
  assert.deepEqual(rasterizeZoneStrokes([brushReversed, rotated], grid), expected);
  assert.ok(expected.length > 40);
});

test("Z-5 a later zone takes shared cells; same-kind touching strokes merge into the oldest zone", () => {
  let state = paint(openField(), "burgage", square(1, 1, 6, 6));
  state = paint(state, "arable", square(4, 1, 9, 6));
  const [burgage, arable] = zonesOf(state);
  assert.equal(burgage!.id, "zone-000001");
  assert.equal(arable!.id, "zone-000002");
  assert.equal(arable!.createdOrdinal, 2);
  assert.equal(zoneAt(state, { tx: 4, ty: 2 })?.id, "zone-000002");
  assert.equal(zoneAt(state, { tx: 3, ty: 2 })?.id, "zone-000001");
  assert.equal(burgage!.membership.length, 15);
  assert.equal(arable!.membership.length, 25);
  // A burgage stroke touching the first zone joins it; the arable cells it covers leave the arable zone.
  state = paint(state, "burgage", square(1, 6, 5, 8));
  assert.equal(state.nextZoneOrdinal, 3);
  assert.equal(zonesOf(state).length, 2);
  const merged = zonesOf(state)[0]!;
  assert.equal(merged.id, "zone-000001");
  assert.equal(merged.strokes.length, 2);
  assert.equal(merged.membership.length, 23);
  // Two burgage zones bridged by one stroke become the older one.
  state = paint(state, "burgage", square(11, 1, 14, 4));
  assert.equal(zonesOf(state).at(-1)!.id, "zone-000003");
  state = paint(state, "burgage", { tool: "brush", radius: 0.5, points: [{ x: 5.5, y: 7.5 }, { x: 12.5, y: 7.5 }, { x: 12.5, y: 4.5 }] });
  assert.deepEqual(zonesOf(state).map(zone => zone.id), ["zone-000001", "zone-000002"]);
  const all = zonesOf(state).flatMap(zone => zone.membership);
  assert.equal(new Set(all).size, all.length);
});

test("Z-6 erasing removes only the stroke cells and deletes emptied zones; membership stays inside the strokes", () => {
  let state = paint(openField(), "burgage", square(1, 1, 6, 6));
  state = paint(state, "pasture", square(8, 8, 10, 10));
  state = gameReducer(state, { type: "zone_erase", stroke: square(0, 0, 3, 16) });
  const burgage = zonesOf(state)[0]!;
  assert.equal(burgage.membership.length, 15);
  assert.ok(burgage.membership.every(cell => rasterizeZoneStrokes(burgage.strokes, state).includes(cell)));
  state = gameReducer(state, { type: "zone_erase", stroke: square(7, 7, 11, 11) });
  assert.deepEqual(zonesOf(state).map(zone => zone.kind), ["burgage"]);
  assert.equal(gameReducer(state, { type: "zone_erase", stroke: square(12, 12, 14, 14) }), state);
});

test("Z-7 zone_remove deletes by id and ignores unknown ids", () => {
  const state = paint(paint(openField(), "orchard", square(1, 1, 3, 3)), "hay_meadow", square(5, 5, 7, 7));
  assert.deepEqual(zonesOf(gameReducer(state, { type: "zone_remove", id: "zone-000001" })).map(zone => zone.kind), ["hay_meadow"]);
  assert.equal(gameReducer(state, { type: "zone_remove", id: "zone-999999" }), state);
});

test("Z-8 zone edits never move or remove a building; mismatched houses are only diagnosed", () => {
  let state = placeRoadLine(openField(), { tx: 0, ty: 5 }, { tx: 15, ty: 5 });
  state = placeBuilding(state, "house", { tx: 2, ty: 4 });
  state = placeBuilding(state, "well", { tx: 8, ty: 4 });
  assert.equal(state.constructionSites.length, 2);
  const before = { tiles: state.tiles, buildings: state.buildings, constructionSites: state.constructionSites };
  assert.deepEqual(zoneMismatches(state), []);
  state = paint(state, "burgage", square(6, 0, 12, 12));
  state = gameReducer(state, { type: "zone_erase", stroke: square(7, 0, 9, 12) });
  state = paint(state, "arable", square(0, 0, 5, 16));
  assert.equal(state.tiles, before.tiles);
  assert.equal(state.buildings, before.buildings);
  assert.equal(state.constructionSites, before.constructionSites);
  // The house site now stands in arable land: diagnosed, not moved. The well has no zone rule.
  assert.deepEqual(zoneMismatches(state).map(entry => [entry.buildingId, entry.rule, entry.reason]), [[before.constructionSites[0]!.id, "burgage", "zone_mismatch"]]);
});

test("Z-10 interiorPlacementTiles keeps anchors whose whole footprint is inside, cached by membership", () => {
  const grid = grassGrid(10, 10);
  // An L: a 3×3 block plus a one-cell tail.
  const membership = [...rasterizeZoneStroke(square(1, 1, 4, 4), grid), 45].sort((a, b) => a - b);
  const zone = { membership };
  assert.deepEqual([...interiorPlacementTiles(zone, { width: 1, height: 1 }, 10)].sort((a, b) => a - b), membership);
  assert.deepEqual([...interiorPlacementTiles(zone, { width: 2, height: 2 }, 10)].sort((a, b) => a - b), [11, 12, 21, 22]);
  assert.deepEqual([...interiorPlacementTiles(zone, { width: 3, height: 3 }, 10)], [11]);
  assert.equal(interiorPlacementTiles({ membership: [...membership] }, { width: 2, height: 2 }, 10), interiorPlacementTiles(zone, { width: 2, height: 2 }, 10));
  // A footprint may not wrap around the map edge.
  assert.deepEqual([...interiorPlacementTiles({ membership: [9, 10] }, { width: 2, height: 1 }, 10)], []);
});
