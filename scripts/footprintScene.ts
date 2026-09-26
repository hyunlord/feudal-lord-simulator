// Footprint lineup (render fix R0-2): one finished building of every kind (house levels, pair lots, facilities, the
// anchor sprites) on cleared grass, in three screen rows, for the in-game before / after captures of
// scripts/footprintCaptures.mjs (the footprint diamond is drawn over each screenshot).
//   tsx scripts/footprintScene.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

type Item = { readonly kind: BuildingKind; readonly level?: number; readonly lot?: "horizontal" | "vertical" };
const ROWS: readonly (readonly Item[])[] = [
  [{ kind: "storehouse" }, { kind: "granary" }, { kind: "church" }, { kind: "market" }, { kind: "keep" }, { kind: "quarry" }, { kind: "well" }],
  [{ kind: "farmstead" }, { kind: "mill" }, { kind: "chapel" }, { kind: "masonry" }, { kind: "sawmill" }, { kind: "logging_camp" }, { kind: "house", level: 2 }],
  [{ kind: "house", level: 2, lot: "horizontal" }, { kind: "house", level: 2, lot: "vertical" }, { kind: "house", level: 3, lot: "horizontal" },
    { kind: "house", level: 4, lot: "vertical" }, { kind: "house", level: 0 }, { kind: "house", level: 4 }],
];
const ROW_SUM = [36, 44, 52];
export const LINEUP_CENTRE = [22, 22] as const;

const base = DEFAULT_GAME_STATE;
const tiles = base.tiles.map(tile => ({ ...tile }));
const buildings: Building[] = [];
const houses: (typeof base.houses[number])[] = [];
const placed: { label: string; tx: number; ty: number; width: number; height: number }[] = [];
ROWS.forEach((row, r) => row.forEach((item, k) => {
  const offset = (k - (row.length - 1) / 2) * 3;
  const tx = Math.round(ROW_SUM[r]! / 2 + offset), ty = ROW_SUM[r]! - tx;
  const id = `lineup-${item.kind}-${r}-${k}`;
  const building: Building = { id, kind: item.kind, tx, ty, workers: 2, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0,
    ...(item.lot === undefined ? {} : { houseLot: item.lot }) };
  const size = buildingFootprint(building);
  buildings.push(building);
  if (item.kind === "house") houses.push({ ...base.houses[0]!, buildingId: id, level: item.level ?? 0, residents: 3, breadStock: 4 });
  placed.push({ label: item.lot === undefined ? `${item.kind}${item.level === undefined ? "" : ` L${item.level}`}` : `house L${item.level} ${item.lot}`, tx, ty, ...size });
}));
// Clear the rows' ground (grass, no road, no tree) with a margin so nothing stands in front of the art.
for (const tile of tiles) {
  const inBand = tile.tx + tile.ty >= 30 && tile.tx + tile.ty <= 58 && Math.abs(tile.tx - tile.ty) <= 26;
  if (inBand) Object.assign(tile, { terrain: "grass", buildingId: null, hasRoad: false });
}
for (const building of buildings) {
  const size = buildingFootprint(building);
  for (let dy = 0; dy < size.height; dy += 1) for (let dx = 0; dx < size.width; dx += 1)
    tiles[(building.ty + dy) * base.width + building.tx + dx]!.buildingId = building.id;
}
const state = { ...base, tiles, buildings, houses, walkers: [], constructionSites: [], zones: [] };
mkdirSync("docs/verification/r0-render-fixes/scene", { recursive: true });
writeFileSync("docs/verification/r0-render-fixes/scene/lineup.json.gz", gzipSync(JSON.stringify(state)));
writeFileSync("docs/verification/r0-render-fixes/scene/lineup-placed.json", JSON.stringify(placed, null, 1) + "\n");
console.log(placed.map(p => `${p.label}@${p.tx},${p.ty}`).join("  "));
