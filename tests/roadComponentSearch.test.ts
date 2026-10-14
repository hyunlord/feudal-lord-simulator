import assert from "node:assert/strict";
import { test } from "node:test";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { newGameState } from "../src/state/newGame";
import { existingRoadComponent, existingRoadComponentByKeys, labelRoadComponents } from "../src/world/roadGraph";

// SIM-SPEED ②b: the road component search on indexes gives the string-keyed search's tiles in its order (starts as the
// caller's objects), and the labels the same map in the same insertion order — on a real map (water, river, fords)
// with random roads, random starts (repeated, off-road) and fresh tile arrays as the bot's what-if maps make them.
function random(seed: number) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

test("the indexed road component search matches the keyed one, tile for tile and in order, and so do the labels", () => {
  const base = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 7 }) as GameState;
  const next = random(11);
  for (let round = 0; round < 6; round += 1) {
    const tiles = base.tiles.map(tile => ({ ...tile, hasRoad: tile.terrain !== "water" && next() < 0.35 }));
    const grid = { ...base, tiles } as GameState;
    for (let trial = 0; trial < 40; trial += 1) {
      const starts = Array.from({ length: 1 + Math.floor(next() * 4) }, () => ({ tx: Math.floor(next() * grid.width), ty: Math.floor(next() * grid.height) }));
      if (trial % 5 === 0) starts.push(starts[0]!);
      const fast = existingRoadComponent(grid, starts); const keyed = existingRoadComponentByKeys(grid, starts);
      assert.deepEqual(fast, keyed);
      fast.forEach((tile, at) => { if (starts.includes(keyed[at]!)) assert.equal(tile, keyed[at]); });
    }
    const labels = labelRoadComponents(grid);
    const reference = new Map<string, number>(); let component = 0;
    for (let index = 0; index < grid.width * grid.height; index += 1) {
      const tile = { tx: index % grid.width, ty: Math.floor(index / grid.width) };
      if (reference.has(`${tile.tx},${tile.ty}`)) continue;
      const members = existingRoadComponentByKeys(grid, [tile]);
      if (members.length === 0) continue;
      for (const member of members) reference.set(`${member.tx},${member.ty}`, component);
      component += 1;
    }
    assert.deepEqual([...labels], [...reference]);
  }
});
