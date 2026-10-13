/**
 * Quarry access ①② (the user's rulings 2026-10-11/12, lord mode): while the town has no quarry, the town's and the bot's
 * site checks refuse a building that would leave no road to any quarry site (`quarry_access`); one elsewhere passes, the
 * sandbox and a town with its quarry are not checked. The state: seed 1's 1317 charter save (lord slice, no quarry yet),
 * with every way to the rock closed but one tile — the case of seed 465's opening village, where one building took the
 * last way to the only rock.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { autoplaySiteCheck } from "../src/engine/autoplay";
import type { GameState } from "../src/engine/engine.types";
import { cutsQuarryAccess, quarryReach } from "../src/engine/quarryAccess";
import { decodeSave } from "../src/save/saveCodec";

const charter = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/charter/seed1-1317-charter.save.json.gz")))).envelope.state as GameState;
const coordinate = (entry: string) => { const [tx, ty] = entry.split(",").map(Number) as [number, number]; return { tx, ty }; };

/**
 * Every free tile within two of a quarry site taken (a stand-in building), but the nearest site, its footprint and the
 * kept road's tiles — so that road is the one way into the rock's ground; `gap` is its first free tile on that ground,
 * `ways` all its free tiles from the town on.
 */
function oneWayToTheRock(): { readonly state: GameState; readonly gap: string; readonly ways: readonly string[] } {
  const reach = quarryReach(charter);
  const path = [...reach.path!];
  const site = reach.site!;
  const keep = new Set([...path, `${site.tx},${site.ty}`, `${site.tx + 1},${site.ty}`, `${site.tx},${site.ty + 1}`, `${site.tx + 1},${site.ty + 1}`]);
  const ground = new Set<string>();
  for (const entry of reach.sites) for (let dy = -2; dy <= 3; dy += 1) for (let dx = -2; dx <= 3; dx += 1) ground.add(`${entry.origin.tx + dx},${entry.origin.ty + dy}`);
  const tiles = charter.tiles.map(tile => {
    const at = `${tile.tx},${tile.ty}`;
    return ground.has(at) && !keep.has(at) && !tile.hasRoad && tile.buildingId === null && tile.terrain !== "rock" ? { ...tile, buildingId: "test-block" } : tile;
  });
  // The road's tiles run from the site back to the network: the first on the rock's ground, coming from the town.
  const free = (entry: string) => charter.tiles.find(tile => `${tile.tx},${tile.ty}` === entry)?.hasRoad !== true;
  const ways = [...path].reverse().filter(free);
  return { state: { ...charter, tiles }, gap: ways.find(entry => ground.has(entry))!, ways };
}

test("Quarry access ①: a building on the last way to the rock cuts the quarry off; one elsewhere does not", () => {
  assert.equal(charter.buildings.some(building => building.kind === "quarry"), false);
  const { state, gap } = oneWayToTheRock();
  const reach = quarryReach(state);
  assert.ok(reach.path !== null, "a road still reaches a quarry site through the one way left");
  assert.equal(cutsQuarryAccess(state, "well", coordinate(gap)), true);
  const far = [...quarryReach(charter).path!].at(-1)!;
  assert.equal(cutsQuarryAccess(state, "well", { tx: coordinate(far).tx + 40, ty: coordinate(far).ty + 40 }), false);
  // The open map: no single well cuts every way.
  assert.equal(cutsQuarryAccess(charter, "well", coordinate(gap)), false);
});

test("Quarry access ②: the site check refuses it as quarry_access — lord mode only, and only while the town has no quarry", () => {
  const { state, ways } = oneWayToTheRock();
  // A tile of the one way where a well passes the checks before it (setback, placement, the wall's room).
  const refused = ways.find(entry => autoplaySiteCheck(state, "well", coordinate(entry)) === "quarry_access");
  assert.ok(refused !== undefined, "some tile of the one way is refused for the quarry's access");
  const { agency: _lord, ...sandbox } = state;
  assert.notEqual(autoplaySiteCheck(sandbox, "well", coordinate(refused)), "quarry_access");
  const quarried: GameState = { ...state, buildings: [...state.buildings, { id: "test-quarry", kind: "quarry", tx: 0, ty: 0, workers: 4,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 }] };
  assert.equal(cutsQuarryAccess(quarried, "well", coordinate(refused)), false);
  assert.equal(cutsQuarryAccess(state, "quarry", coordinate(refused)), false, "a quarry itself is never refused for it");
});
