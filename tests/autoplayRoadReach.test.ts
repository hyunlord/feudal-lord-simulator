/**
 * DELIVERY-GAP ①a (the user's rulings 2026-10-16/17, both modes): the bot's "road first" step picks its candidates among the
 * sites a construction road reaches, nearest by that road. The state: seed 26 (lord slice) at the first tick of 1316,
 * from the trunk 00125eb9 (DGX engine-GAP-save26-00125eb) — charter 1312, no quarry, the stone town's 400 stone unmet:
 * of its 172 quarry sites only (21,47) passes the bot's checks once a road reaches it, five road tiles off; the nearest
 * by the straight line to any road, (60,55) and on, lie where no construction road reaches (engine-GAP-diag2-00125eb).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { autoplayBuildAction } from "../src/engine/autoplay";
import { hasAutoplayBuildingClearance } from "../src/engine/autoplaySetback";
import { autoplayCanPlace } from "../src/engine/autoplayZones";
import { constructionRoadDistance } from "../src/engine/autoplayRoadReach";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { autoplayActionToGameAction } from "../src/engine/autoplayActions";
import { gameReducer } from "../src/state/gameStore";
import { zonesOf } from "../src/zones/zoneEdits";

const state = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/charter/seed26-1316.save.json.gz")))).envelope.state as GameState;
const candidates = state.tiles.filter(tile => hasAutoplayBuildingClearance(state, "quarry", tile) && autoplayCanPlace(state, "quarry", tile.tx, tile.ty, "later"));

test("DELIVERY-GAP ①a: the straight line's nearest quarry sites have no construction road — the old ranking tried only those", () => {
  assert.equal(state.buildings.some(building => building.kind === "quarry"), false);
  const roads = state.tiles.filter(tile => tile.hasRoad);
  // The old candidates: the setback ring all land (a quarry may now keep water there, the next test).
  const ringDry = (tile: { tx: number; ty: number }) => { for (let ty = tile.ty - 1; ty <= tile.ty + 2; ty += 1) for (let tx = tile.tx - 1; tx <= tile.tx + 2; tx += 1)
    if (state.tiles[ty * state.width + tx]?.terrain === "water") return false; return true; };
  const straight = candidates.filter(ringDry).map(tile => ({ tile, distance: Math.min(...roads.map(road => Math.abs(road.tx - tile.tx) + Math.abs(road.ty - tile.ty))) }))
    .sort((a, b) => a.distance - b.distance || a.tile.ty - b.tile.ty || a.tile.tx - b.tile.tx).slice(0, 24);
  assert.equal(straight.length, 24);
  assert.ok(straight.every(({ tile }) => !Number.isFinite(constructionRoadDistance(state, "quarry", tile))), "no road reaches any of the 24");
  assert.equal(constructionRoadDistance(state, "quarry", { tx: 21, ty: 47 }), 5);
});

test("DELIVERY-GAP ①a: a quarry site not on a field and refused only for its water setback opens (밭이 아니고 물가 간격만 걸린 자리) — the bot lays its road there and builds the quarry", () => {
  // (21,47), the one site the road reaches that passed the setback, covers a field (AF-13 keeps buildings off fields);
  // (21,45) is no field and failed only on the water in its setback ring — a quarry may now keep water there.
  const fields = new Set(zonesOf(state).filter(zone => zone.kind === "arable").flatMap(zone => zone.membership));
  const onField = (tile: { tx: number; ty: number }) => [[0, 0], [1, 0], [0, 1], [1, 1]].some(([dx, dy]) => fields.has((tile.ty + dy!) * state.width + tile.tx + dx!));
  assert.equal(onField({ tx: 21, ty: 47 }), true);
  assert.equal(onField({ tx: 21, ty: 45 }), false);
  assert.equal(hasAutoplayBuildingClearance(state, "quarry", { tx: 21, ty: 45 }), true, "water in the ring, a road-reached land side");
  assert.equal(hasAutoplayBuildingClearance(state, "storehouse", { tx: 21, ty: 45 }), false, "every other kind keeps its setback");
  // The bot's own actions from the 1316 state: roads toward the open site, then the quarry on it.
  let town = state;
  let placed: { tx: number; ty: number } | null = null;
  for (let step = 0; step < 12 && placed === null; step += 1) {
    const action = autoplayBuildAction(town, "quarry");
    if (action.kind === "place_building") { placed = { tx: action.tx, ty: action.ty }; break; }
    assert.equal(action.kind, "place_road", JSON.stringify(action));
    const command = autoplayActionToGameAction(action, town);
    assert.ok(command !== null);
    town = gameReducer(town, command!);
  }
  assert.ok(placed !== null, "the quarry is placed once its road is laid");
  assert.equal(Number.isFinite(constructionRoadDistance(town, "quarry", placed!)), true);
  assert.equal(onField(placed!), false);
});
