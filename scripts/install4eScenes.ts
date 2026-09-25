// INSTALL-4e evidence scenes (docs/verification/install4e/scene/): states the captures open.
//  - pasture-seed4: the seed 4 final state (fixture) with one pasture painted by brush on the largest open grass
//    square (no road, building or water) near its forest: the four sheep flocks (and cattle) graze there; the seed 4
//    forest edge shows the pig pairs (no woodland common zone).
//  - yard-seed5: the seed 5 final state (a yard ring closed with the short gate and a half panel).
// Usage: npx tsx scripts/install4eScenes.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { gameReducer } from "../src/state/gameStore";
import { seedGroundState } from "./boundaryFixtureStates";

const OUT = "docs/verification/install4e/scene";
mkdirSync(OUT, { recursive: true });
const write = (name: string, state: GameState) => writeFileSync(`${OUT}/${name}.json.gz`, gzipSync(JSON.stringify(state)));

const seed4 = seedGroundState(4);
const open = (tx: number, ty: number): boolean => {
  const tile = seed4.tiles[ty * seed4.width + tx];
  return tile !== undefined && tile.terrain === "grass" && !tile.hasRoad && tile.buildingId === null;
};
// The largest open square (side <= 9), first in scan order.
let best = { tx: 0, ty: 0, side: 0 };
for (let ty = 0; ty < seed4.height; ty += 1) for (let tx = 0; tx < seed4.width; tx += 1) {
  let side = best.side + 1;
  while (side <= 9 && tx + side <= seed4.width && ty + side <= seed4.height
    && Array.from({ length: side * side }, (_, i) => open(tx + (i % side), ty + Math.floor(i / side))).every(Boolean)) side += 1;
  if (side - 1 > best.side) best = { tx, ty, side: side - 1 };
}
const points = Array.from({ length: best.side }, (_, row) => [0, best.side - 1].map(col => ({ x: best.tx + (row % 2 === 0 ? col : best.side - 1 - col) + 0.5, y: best.ty + row + 0.5 }))).flat();
const pasture = gameReducer(seed4, { type: "zone_paint", kind: "pasture", stroke: { tool: "brush", radius: 1, points } });
write("pasture-seed4", pasture);
write("yard-seed5", seedGroundState(5));
console.log(JSON.stringify({ pasture: best }));
