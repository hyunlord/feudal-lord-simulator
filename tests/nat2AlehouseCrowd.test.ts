import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { isAlehouse } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { aleBarrelPile } from "../src/render/aleWorldArt";
import { alehouseDrinkers, DRINKER_LONGEST_STAY_MS, type AleDrinker } from "../src/render/alehouseCrowd";
import { screenToTile, tileToScreen } from "../src/render/iso";
import { brewingDoor } from "../src/render/villageLife";
import { figureOrderFaults } from "../src/render/walkerOcclusion";
import { decodeSave } from "../src/save/saveCodec";
import { drawOrders } from "../scripts/nat1Occlusion";

// NAT-2 (QA-002, QA-005): the alehouse crowd of the 1380 town (the perf fixture, every one of its 24 houses an alehouse
// in the boom). UI-9 stood 3–4 drinkers at each for good, drawn after every object below the house — on the granary's
// wall, on roofs. Now they come out by the ale barrels on the free door tile, drink 5–8 s, go back in.

const TOWN = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/perf-gate/ch4-1380.save.json.gz")))).envelope.state as unknown as GameState;
const houses = TOWN.buildings.filter(building => building.kind === "house");
const drinkersAt = (lifeMs: number): readonly (AleDrinker & { readonly houseId: string })[] =>
  houses.flatMap(building => alehouseDrinkers(TOWN, building, lifeMs).map(drinker => ({ ...drinker, houseId: building.id })));
const SAMPLE_MS = 100; const SPAN_MS = 60_000;

test("NAT-2: drinkers only where the ale barrels stand on a free door tile, one per barrel level", () => {
  const counts = new Map<string, number>();
  for (let ms = 0; ms < SPAN_MS; ms += SAMPLE_MS) {
    for (const drinker of drinkersAt(ms)) {
      counts.set(drinker.id, 1);
      const house = TOWN.houses.find(entry => entry.buildingId === drinker.houseId)!;
      const barrels = aleBarrelPile(house); const door = brewingDoor(TOWN, drinker.houseId);
      assert.ok(isAlehouse(house) && barrels !== null && door !== null, drinker.id);
      assert.ok(Number(drinker.id.split(":").at(-1)) < Number(barrels.slice(-1)), `${drinker.id}: more drinkers than barrel levels`);
      // On the door tile: its foot on no building's footprint and no construction site.
      const cell = { tx: Math.round(door.x), ty: Math.round(door.y) };
      assert.ok(Math.abs(drinker.tx - cell.tx) <= 0.5 && Math.abs(drinker.ty - cell.ty) <= 0.5, `${drinker.id} off its door tile`);
      const tile = TOWN.tiles[cell.ty * TOWN.width + cell.tx]!;
      assert.equal(tile.buildingId, null, `${drinker.id} on a building`);
    }
  }
  const alehouses = new Set([...counts.keys()].map(id => id.slice(0, id.lastIndexOf(":"))));
  assert.ok(alehouses.size >= 5, `${alehouses.size} alehouses with a crowd`);
  assert.ok(counts.size <= 3 * alehouses.size);
});

test("NAT-2: nobody stands 10 s — each drinker's longest stay on one spot is at most 8 s, and each goes in", () => {
  const runs = new Map<string, { at: string; since: number; longest: number; hidden: number }>();
  for (let ms = 0; ms < SPAN_MS; ms += SAMPLE_MS) {
    const shown = new Map(drinkersAt(ms).map(drinker => [drinker.id, drinker]));
    for (const id of new Set([...runs.keys(), ...shown.keys()])) {
      const drinker = shown.get(id); const run = runs.get(id) ?? { at: "", since: ms, longest: 0, hidden: 0 };
      const at = drinker === undefined ? "inside" : `${drinker.tx.toFixed(3)},${drinker.ty.toFixed(3)}`;
      if (at !== run.at) { run.at = at; run.since = ms; }
      if (drinker === undefined) run.hidden += 1; else run.longest = Math.max(run.longest, ms - run.since + SAMPLE_MS);
      runs.set(id, run);
    }
  }
  assert.ok(runs.size >= 10, `${runs.size} drinkers`);
  for (const [id, run] of runs) {
    assert.ok(run.longest <= DRINKER_LONGEST_STAY_MS + SAMPLE_MS && run.longest < 10_000, `${id} stood ${run.longest} ms`);
    assert.ok(run.hidden > 0, `${id} never went in`);
  }
  // Paused (the village life's clock holds): the same picture frame after frame.
  assert.deepEqual(drinkersAt(12_345), drinkersAt(12_345));
});

test("NAT-2 QA-005: by the box rule no drinker shows on an object it stands behind, nor under one it stands in front of", () => {
  // The whole town's queue as the renderer builds and places it (NAT-1's drawOrders): each drinker's place among the objects.
  const { queue, placed } = drawOrders(TOWN);
  const places = new Map(placed.flatMap((item, index) => item.kind === "ale_drinker" ? [[item.stand.id, index] as const] : []));
  assert.ok(places.size >= 10, `${places.size} drinker places in the queue`);
  let checked = 0; const faults: string[] = [];
  for (let ms = 0; ms < 30_000; ms += 250) {
    for (const drinker of drinkersAt(ms)) {
      const result = figureOrderFaults(placed, TOWN, { tx: drinker.tx, ty: drinker.ty }, places.get(drinker.id)!);
      faults.push(...result.onRoof.map(id => `${drinker.id} on ${id}`), ...result.hidden.map(id => `${drinker.id} under ${id}`));
      checked += 1;
    }
  }
  assert.ok(checked > 500, `${checked} drinker frames`);
  assert.deepEqual(faults, []);
  // UI-9's placement for comparison: three or four drinkers per alehouse at the point below the house (its door),
  // drawn after every object. Astra's granary wall and house roof (QA-005) are among these.
  const old: string[] = [];
  const offsets = [{ ox: -16, oy: 8 }, { ox: 14, oy: 10 }, { ox: -4, oy: 20 }];
  for (const building of houses) {
    const house = TOWN.houses.find(entry => entry.buildingId === building.id);
    if (house === undefined || !isAlehouse(house)) continue;
    const size = buildingFootprint(building);
    const door = tileToScreen(building.tx + size.width / 2 - 0.5, building.ty + size.height + 0.1);
    for (const offset of offsets) {
      const foot = screenToTile(door.sx + offset.ox, door.sy + offset.oy);
      old.push(...figureOrderFaults(queue, TOWN, foot, queue.length - 1).onRoof);
    }
  }
  assert.ok(old.length > 20, `UI-9 placement: ${old.length} drinker-object pairs on objects`);
});

test("NAT-2: no crowd before the boom or after the reorganisation ends", () => {
  const reorg = TOWN.reorganisation!;
  const before = { ...TOWN, reorganisation: { ...reorg, alehouseBoomTick: undefined } } as unknown as GameState;
  const ended = { ...TOWN, reorganisation: { ...reorg, endedTick: TOWN.tick } } as unknown as GameState;
  for (const state of [before, ended]) assert.equal(houses.reduce((sum, building) => sum + alehouseDrinkers(state, building, 5_000).length, 0), 0);
});
