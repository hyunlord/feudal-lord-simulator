/**
 * STONE-1 ⓑ (the user's ruling 2026-10-21, lord mode): a wall site held for want of a route reads `stock_unreachable`,
 * not `reserve_held`. The state: seed 32 (lord slice) at the first tick of 1326 (DGX engine-STORE-save32-c0e0ac7) — nine
 * stone-wall sites `reserve_held`, the stone in buildings outside the wall that no delivery route reaches.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import type { GameState } from "../src/engine/engine.types";
import { wallStallCause, wallStockReach } from "../src/engine/wallStallCause";
import { decodeSave } from "../src/save/saveCodec";

const town = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/store/seed32-1326.save.json.gz")))).envelope.state as GameState;
const wallSites = town.constructionSites.filter(site => site.kind === "stone_wall_segment");

test("STONE-1 ⓑ: seed 32's held wall sites read stock_unreachable — the stone lies where no route reaches", () => {
  assert.equal(wallSites.length, 9);
  for (const site of wallSites) {
    assert.equal(site.stall, "reserve_held");
    const reach = wallStockReach(town, site)!;
    assert.equal(reach.resource, "stone");
    assert.ok(reach.unreachable >= 300, `${site.id}: ${reach.unreachable} unreachable`);
    assert.equal(wallStallCause(town, site), "stock_unreachable", site.id);
  }
});

test("STONE-1 ⓑ: with no unreachable stone the reserve is the cause, as before", () => {
  // The stone outside the wall taken away: only the storehouse inside (41,40) keeps its stone, at the reserve floor.
  const cleared = { ...town, buildings: town.buildings.map(building => building.id === "storehouse-41-40-0" || (building.inventory.stone ?? 0) === 0
    ? building : { ...building, inventory: { ...building.inventory, stone: 0 } }) } as GameState;
  for (const site of wallSites) assert.equal(wallStallCause(cleared, site), "reserve_held", site.id);
});

test("STONE-1 ⓑ: the sandbox keeps the saved stall", () => {
  const { agency: _agency, ...sandbox } = town;
  for (const site of wallSites) assert.equal(wallStallCause(sandbox as GameState, site), "reserve_held", site.id);
});
