// INSTALL-7 evidence scenes (scripts/install7Captures.mjs), from the new-game map:
//  - signals: a mill paused by the lord (S9 latch), a market on a market day with nothing to sell (S6 empty stall),
//    one opening household preparing to leave (S12 bundles) and one house abandoned (boarded windows), a barn with
//    no road (S2, shown once it has held a distribution cycle: the capture runs the scene briefly);
//  - newgame-winter: the same map in its first winter (frost patches on open grass, snow on the roofs);
//  - newgame-autumn / newgame-summer: leaves and dry grass.
//   tsx scripts/install7Scenes.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import type { Building } from "../src/content/buildingConfig";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { isMarketDay } from "../src/ui/residentTrips";

const base = DEFAULT_GAME_STATE;
const out = "docs/verification/install7/scene";
mkdirSync(out, { recursive: true });
const write = (name: string, state: unknown) => writeFileSync(`${out}/${name}.json.gz`, gzipSync(JSON.stringify(state)));
const building = (id: string, kind: Building["kind"], tx: number, ty: number, patch: Partial<Building> = {}): Building =>
  ({ id, kind, tx, ty, workers: 1, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, ...patch });

const marketDay = Array.from({ length: 4_000 }, (_, tick) => 8_000 + tick).find(tick => isMarketDay(tick))!;
const extra = [
  building("i7-mill-paused", "mill", 42, 45, { operationPaused: true, inventory: { wheat: 4 } }),
  building("i7-market-empty", "market", 38, 42),
  building("i7-barn-offroad", "farmstead", 39, 47),
];
const tiles = base.tiles.map(tile => ({ ...tile }));
for (const b of extra) {
  const size = b.kind === "market" ? 2 : 1;
  for (let dy = 0; dy < size; dy += 1) for (let dx = 0; dx < size; dx += 1) {
    const tile = tiles[(b.ty + dy) * base.width + b.tx + dx]!;
    if (tile.terrain !== "grass" || tile.buildingId !== null || tile.hasRoad) throw new Error(`${b.id} not on free grass at ${tile.tx},${tile.ty}`);
    tile.buildingId = b.id;
  }
}
const houses = base.houses.map((house, index) => index === 0 ? { ...house, breadStock: 4, foodShortSinceTick: marketDay - 1_500, leavingSinceTick: marketDay - 400 }
  : index === 1 ? { ...house, residents: 0, breadStock: 0, abandonedTick: marketDay - 300 } : { ...house, breadStock: 4 });
write("signals", { ...base, tick: marketDay, tiles, buildings: [...base.buildings, ...extra], houses });
const fed = base.houses.map(house => ({ ...house, breadStock: 4 }));
write("newgame-winter", { ...base, tick: 3_300, houses: fed });
write("newgame-autumn", { ...base, tick: 2_300, houses: fed });
write("newgame-summer", { ...base, tick: 1_300, houses: fed });
console.log(`signals at tick ${marketDay} (market day); newgame winter / autumn / summer`);
