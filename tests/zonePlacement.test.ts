import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BUILDING_CONFIG, type BuildingKind } from "../src/content/buildingConfig";
import { ZONE_FILL_MAX_PARCELS } from "../src/content/zoneConfig";
import { decideNextAction } from "../src/engine/autoplay";
import type { GameState } from "../src/engine/engine.types";
import { placeBuilding } from "../src/engine/gameActions";
import { decodeSave } from "../src/save/saveCodec";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { buildingPlacementPrediction } from "../src/ui/placementPrediction";
import { zoneMismatchLines, zonePaintLines, ZONE_PLACEMENT_REASON_LABELS } from "../src/ui/zonePrediction";
import { canPlaceBuilding } from "../src/world/placement";
import { ZONE_CAUSE_LABELS } from "../src/zones/zoneCopy.ko";
import { cellInsideWall, zonePaintAssessment, zonesOf } from "../src/zones/zoneEdits";
import { burgageParcels, planZoneFill, zoneFillAction } from "../src/zones/zoneFillAgent";
import { canPlaceBuildingWithZones, zoneMismatches, ZonePlacementFailure } from "../src/zones/zonePlacement";
import type { ZoneStroke } from "../src/zones/zone.types";

const TOWN = JSON.parse(readFileSync("fixtures/zones/town-with-arable.json", "utf8")) as {
  readonly source: { readonly sha256: string; readonly tick: number };
  readonly strokes: { readonly outsideArable: ZoneStroke; readonly insideArable: ZoneStroke; readonly outsideBurgage: ZoneStroke };
  readonly state: Partial<GameState>;
};

/** The seed-2 walled town (B2 guardrail final state, trimmed) as a full GameState with no zone. */
function town(): GameState {
  return { ...structuredClone(DEFAULT_GAME_STATE), ...structuredClone(TOWN.state), pathCache: {}, walkers: [], zones: [], nextZoneOrdinal: 1 } as GameState;
}

function tiles(state: GameState) {
  return state.tiles.map(tile => ({ tx: tile.tx, ty: tile.ty }));
}

function firstSpot(state: GameState, kind: BuildingKind, accept: (tx: number, ty: number) => boolean) {
  return tiles(state).find(({ tx, ty }) => canPlaceBuilding(state, kind, tx, ty).ok && accept(tx, ty)) ?? null;
}

test("Z-11 with no zone every building and tile answers exactly as canPlaceBuilding (new game and the seed-2 town)", () => {
  for (const state of [structuredClone(DEFAULT_GAME_STATE), town()]) {
    for (const definition of BUILDING_CONFIG) {
      for (const { tx, ty } of tiles(state)) {
        assert.deepEqual(canPlaceBuildingWithZones(state, definition.kind, tx, ty), canPlaceBuilding(state, definition.kind, tx, ty));
      }
    }
  }
});

test("Z-9 arable land can be painted outside the seed-2 wall but never inside it", () => {
  const state = town();
  assert.equal(TOWN.source.tick, 419_117);
  const inside = zonePaintAssessment(state, "arable", TOWN.strokes.insideArable);
  assert.equal(inside.ok, false);
  assert.equal(!inside.ok && inside.reason, "arable_inside_wall");
  assert.ok(inside.cells.some(cell => cellInsideWall(state, cell)));
  assert.equal(gameReducer(state, { type: "zone_paint", kind: "arable", stroke: TOWN.strokes.insideArable }), state);
  assert.deepEqual(zonePaintLines(state, "arable", TOWN.strokes.insideArable).map(line => [line.severity, line.text]), [["block", "성내 경작지 금지"]]);
  // The same stroke is fine for a burgage zone: only arable is forbidden inside the wall.
  assert.equal(zonePaintAssessment(state, "burgage", TOWN.strokes.insideArable).ok, true);
  const painted = gameReducer(state, { type: "zone_paint", kind: "arable", stroke: TOWN.strokes.outsideArable });
  assert.deepEqual(zonesOf(painted).map(zone => [zone.kind, zone.membership.length]), [["arable", 96]]);
});

test("Z-11 with zones, a wheat farm needs arable land outside the wall and a house needs burgage land", () => {
  const plain = town();
  const zoned = gameReducer(plain, { type: "zone_paint", kind: "arable", stroke: TOWN.strokes.outsideArable });
  const arable = new Set(zonesOf(zoned)[0]!.membership);
  const inArable = (tx: number, ty: number) => [0, 1].every(dy => [0, 1].every(dx => arable.has((ty + dy) * zoned.width + tx + dx)));
  const farmInside = firstSpot(zoned, "wheat_farm", inArable);
  const farmOutside = firstSpot(zoned, "wheat_farm", (tx, ty) => !inArable(tx, ty) && !cellInsideWall(zoned, ty * zoned.width + tx));
  const farmInWall = firstSpot(zoned, "wheat_farm", (tx, ty) => cellInsideWall(zoned, ty * zoned.width + tx));
  assert.ok(farmInside !== null && farmOutside !== null && farmInWall !== null);
  assert.deepEqual(canPlaceBuildingWithZones(zoned, "wheat_farm", farmInside.tx, farmInside.ty), { ok: true });
  assert.notEqual(placeBuilding(zoned, "wheat_farm", farmInside), zoned);
  assert.deepEqual(canPlaceBuildingWithZones(zoned, "wheat_farm", farmOutside.tx, farmOutside.ty),
    { ok: false, reason: ZonePlacementFailure.outside_zone, rule: "arable" });
  assert.equal(placeBuilding(zoned, "wheat_farm", farmOutside), zoned);
  assert.deepEqual(canPlaceBuildingWithZones(zoned, "wheat_farm", farmInWall.tx, farmInWall.ty),
    { ok: false, reason: ZonePlacementFailure.arable_inside_wall, rule: "arable" });
  assert.equal(placeBuilding(zoned, "wheat_farm", farmInWall), zoned);
  // The same outside spot is legal again once the zones are gone.
  assert.notEqual(placeBuilding(plain, "wheat_farm", farmOutside), plain);
  // Houses (C1c, Z-11a): an arable zone alone leaves houses free; once a burgage zone exists they need it.
  const house = firstSpot(zoned, "house", () => true)!;
  assert.deepEqual(canPlaceBuildingWithZones(zoned, "house", house.tx, house.ty), { ok: true });
  const withBurgage = gameReducer(zoned, { type: "zone_paint", kind: "burgage", stroke: TOWN.strokes.outsideBurgage });
  const burgage = new Set(zonesOf(withBurgage).find(zone => zone.kind === "burgage")!.membership);
  const houseOutside = firstSpot(withBurgage, "house", (tx, ty) => !burgage.has(ty * withBurgage.width + tx))!;
  assert.deepEqual(canPlaceBuildingWithZones(withBurgage, "house", houseOutside.tx, houseOutside.ty),
    { ok: false, reason: ZonePlacementFailure.outside_zone, rule: "burgage" });
  const houseInside = firstSpot(withBurgage, "house", (tx, ty) => burgage.has(ty * withBurgage.width + tx))!;
  assert.deepEqual(canPlaceBuildingWithZones(withBurgage, "house", houseInside.tx, houseInside.ty), { ok: true });
  // Workshops, wells and markets ignore zones.
  const well = firstSpot(withBurgage, "well", (tx, ty) => !burgage.has(ty * withBurgage.width + tx) && !arable.has(ty * withBurgage.width + tx))!;
  assert.deepEqual(canPlaceBuildingWithZones(withBurgage, "well", well.tx, well.ty), { ok: true });
});

test("Z-16 cause rows and placement preview lines for the zone rules", () => {
  assert.deepEqual(ZONE_CAUSE_LABELS, { outside_zone: "구역 밖", zone_mismatch: "구역과 불일치", arable_inside_wall: "성내 경작지 금지" });
  assert.deepEqual(ZONE_PLACEMENT_REASON_LABELS, { outside_zone: "구역 밖", arable_inside_wall: "성내 경작지 금지" });
  const zoned = gameReducer(gameReducer(town(), { type: "zone_paint", kind: "arable", stroke: TOWN.strokes.outsideArable }),
    { type: "zone_paint", kind: "burgage", stroke: TOWN.strokes.outsideBurgage });
  const [arable, burgage] = zonesOf(zoned);
  const arableSet = new Set(arable!.membership);
  const burgageSet = new Set(burgage!.membership);
  const lineOf = (kind: BuildingKind, tx: number, ty: number) =>
    buildingPlacementPrediction(zoned, kind, { tx, ty }).lines.filter(line => line.id === "zone").map(line => ({ severity: "severity" in line ? line.severity : null, text: line.text, sources: "sources" in line ? line.sources : [] }));
  const house = firstSpot(zoned, "house", (tx, ty) => burgageSet.has(ty * zoned.width + tx))!;
  assert.deepEqual(lineOf("house", house.tx, house.ty), [{ severity: "ok", text: "필지 구역 안 · 배치 가능", sources: [{ type: "zone", id: burgage!.id }] }]);
  const farm = firstSpot(zoned, "wheat_farm", (tx, ty) => [0, 1].every(dy => [0, 1].every(dx => arableSet.has((ty + dy) * zoned.width + tx + dx))))!;
  assert.deepEqual(lineOf("wheat_farm", farm.tx, farm.ty), [{ severity: "ok", text: "경작지 구역 안 · 배치 가능", sources: [{ type: "zone", id: arable!.id }] }]);
  const outside = firstSpot(zoned, "wheat_farm", (tx, ty) => !arableSet.has(ty * zoned.width + tx) && !cellInsideWall(zoned, ty * zoned.width + tx))!;
  assert.deepEqual(lineOf("wheat_farm", outside.tx, outside.ty), [{ severity: "block", text: "경작지 구역 밖", sources: [] }]);
  const houseOutside = firstSpot(zoned, "house", (tx, ty) => !burgageSet.has(ty * zoned.width + tx))!;
  assert.deepEqual(lineOf("house", houseOutside.tx, houseOutside.ty), [{ severity: "block", text: "필지 구역 밖", sources: [] }]);
  assert.deepEqual(lineOf("well", house.tx, house.ty), []);
  // Standing farms outside the new arable zone are diagnosed, never moved.
  const mismatched = zoneMismatches(zoned).filter(entry => entry.kind === "wheat_farm");
  assert.ok(mismatched.length > 0);
  assert.deepEqual(zoned.buildings, town().buildings);
  assert.deepEqual(zoneMismatchLines(zoned, mismatched[0]!.buildingId).map(line => [line.severity, line.text]), [["warn", "구역과 불일치"]]);
  assert.deepEqual(zoneMismatchLines(town(), mismatched[0]!.buildingId), []);
});

function zonedOpening(): GameState {
  return decodeSave(new Uint8Array(readFileSync("fixtures/saves/v6/zoned-opening.save.json"))).envelope.state;
}

test("Z-14 ZoneFillAgent puts L0 houses on plot frontage only, deterministically, and stops at 10 plots under construction", () => {
  const start = zonedOpening();
  const parcels = burgageParcels(start);
  assert.ok(parcels.length > 0);
  const plan = planZoneFill(start);
  assert.deepEqual(planZoneFill(start), plan);
  const frontage = new Set(parcels.flatMap(parcel => parcel.frontageCells.map(cell => `${cell.tx},${cell.ty}`)));
  assert.ok(plan.placements.every(placement => frontage.has(`${placement.tile.tx},${placement.tile.ty}`)));
  assert.ok(plan.placements.length <= ZONE_FILL_MAX_PARCELS);
  // Fill until the agent stops: every house lands on a distinct plot and at most 10 wait at once.
  let state = start;
  for (let round = 0; round < 40; round += 1) {
    const next = zoneFillAction(state);
    if (next === null || next.kind !== "place_building") break;
    const placed = gameReducer(state, { type: "place_building", kind: next.building, tx: next.tx, ty: next.ty });
    assert.notEqual(placed, state, "the agent only proposes placements the reducer accepts");
    state = placed;
  }
  const houseSites = state.constructionSites.filter(site => site.kind === "house");
  assert.ok(houseSites.length <= ZONE_FILL_MAX_PARCELS);
  const plots = burgageParcels(state);
  for (const site of houseSites) assert.equal(plots.filter(parcel => parcel.buildingIds.includes(site.id)).length, 1);
  // The opening's burgage strip has 6 plots: one already holds an opening house, the agent filled the other 5.
  assert.equal(plots.length, 6);
  assert.equal(houseSites.length, 5);
  assert.equal(plots.filter(parcel => parcel.buildingIds.length === 0).length, 0);
});

test("Z-14 ZoneFillAgent plans at most 10 plots and then waits while 10 house plots are under construction", () => {
  // A 32-tile straight street on open grass with burgage land on both sides.
  const width = 32;
  const field: GameState = { ...structuredClone(DEFAULT_GAME_STATE), width, height: width, buildings: [], houses: [], constructionSites: [], idleWorkers: 8,
    tiles: Array.from({ length: width * width }, (_, index) => ({ tx: index % width, ty: Math.floor(index / width), terrain: "grass" as const,
      buildingId: null, hasRoad: Math.floor(index / width) === 10 })) };
  const street: ZoneStroke = { tool: "polygon", points: [{ x: 0, y: 7 }, { x: 32, y: 7 }, { x: 32, y: 14 }, { x: 0, y: 14 }] };
  let state: GameState = gameReducer(field, { type: "zone_paint", kind: "burgage", stroke: street });
  const empty = burgageParcels(state).filter(parcel => parcel.buildingIds.length === 0);
  assert.ok(empty.length > ZONE_FILL_MAX_PARCELS, `${empty.length} empty plots`);
  const plan = planZoneFill(state);
  assert.equal(plan.placements.length, ZONE_FILL_MAX_PARCELS);
  // Open grass: the batch is simply the first 10 plots in plot order, each house on its anchor.
  assert.deepEqual(plan.placements, empty.slice(0, ZONE_FILL_MAX_PARCELS).map(parcel => ({ parcelId: parcel.id, tile: parcel.anchor })));
  for (const placement of plan.placements) state = gameReducer(state, { type: "place_building", kind: "house", tx: placement.tile.tx, ty: placement.tile.ty });
  assert.equal(state.constructionSites.filter(site => site.kind === "house").length, ZONE_FILL_MAX_PARCELS);
  assert.deepEqual(planZoneFill(state), { placements: [], blocked: [{ parcelId: null, reason: "in_progress_limit" }] });
});

test("Z-14 ZoneFillAgent explains empty plots: no plots, no idle labour", () => {
  const noRoad = gameReducer(structuredClone(DEFAULT_GAME_STATE), { type: "zone_paint", kind: "burgage", stroke: { tool: "polygon", points: [{ x: 10, y: 55 }, { x: 16, y: 55 }, { x: 16, y: 60 }, { x: 10, y: 60 }] } });
  assert.deepEqual(planZoneFill(noRoad), { placements: [], blocked: [{ parcelId: null, reason: "no_parcels" }] });
  const opening = zonedOpening();
  const busy = { ...opening, idleWorkers: 0 };
  assert.ok(busy.constructionSites.length > 0);
  assert.deepEqual(planZoneFill(busy).blocked, [{ parcelId: null, reason: "labour" }]);
});

test("Z-15 DevAutoPlayer asks ZoneFillAgent first when zones exist, and a zone-free state decides as before", () => {
  const opening = zonedOpening();
  const beforeFill = { ...opening, constructionSites: [], tiles: opening.tiles.map(tile => (tile.buildingId?.startsWith("construction-site") ? { ...tile, buildingId: null } : tile)) };
  const fill = zoneFillAction(beforeFill);
  assert.ok(fill !== null);
  assert.deepEqual(decideNextAction(beforeFill), fill);
  const plain = structuredClone(DEFAULT_GAME_STATE);
  const { zones: _zones, nextZoneOrdinal: _ordinal, ...preZone } = plain;
  assert.deepEqual(decideNextAction(plain), decideNextAction(preZone));
});
