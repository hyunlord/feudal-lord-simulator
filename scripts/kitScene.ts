// INSTALL-11 kit lineup: one building site per kit size (timber small / medium, stone medium / large, church, keep)
// in four stages each (work 10 / 40 / 70 / 95 %, materials in, builders on), and a stone wall site with a corner turn
// in each stage, on cleared grass; for scripts/kitCaptures.mjs.
//   tsx scripts/kitScene.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { createConstructionSite, createStoneWallConstructionSite, type ConstructionSite } from "../src/economy/construction";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

const base = DEFAULT_GAME_STATE;
const ROWS = [["house", "farmstead", "masonry"], ["storehouse", "church", "keep"]] as const;
const WORK = [0.1, 0.4, 0.7, 0.95];
const sites: ConstructionSite[] = [];
const placed: { kind: string; stage: number; tx: number; ty: number }[] = [];
let ordinal = 900;
// Row r, column c: kinds run along the screen row (tx + ty constant), stages step down-right.
ROWS.forEach((row, r) => row.forEach((kind, c) => WORK.forEach((work, stage) => {
  const sum = 30 + r * 28 + stage * 6;
  const tx = Math.round(sum / 2 + (c - 1) * 5 + stage * 0), ty = sum - tx;
  const site = createConstructionSite({ ordinal: ordinal++, kind, tx, ty, startedTick: 0 });
  sites.push({ ...site, delivered: site.required, builderTicks: Math.round(site.requiredBuilderTicks * work), assignedBuilders: 2, stall: "none" as const });
  placed.push({ kind, stage, tx, ty });
})));
WORK.forEach((work, stage) => {
  const x = 30 + stage * 6, y = 50;
  const wall = createStoneWallConstructionSite({ id: `kit-wall-${stage}`, wallId: "kit-wall", segmentIndex: stage, gateDistance: 99, order: stage,
    path: [{ x, y }, { x: x + 2, y }, { x: x + 2, y: y + 2 }], startedTick: 0 });
  sites.push({ ...wall, delivered: wall.required, builderTicks: Math.round(wall.requiredBuilderTicks * work), assignedBuilders: 2 });
  placed.push({ kind: "stone_wall", stage, tx: x + 2, ty: y });
});
const tiles = base.tiles.map(tile => ({ ...tile, terrain: tile.terrain === "water" ? tile.terrain : "grass" as const, hasRoad: false, buildingId: null }));
const state = { ...base, tiles, buildings: [], houses: [], walkers: [], zones: [], constructionSites: sites, tick: 1_200 };
mkdirSync("docs/verification/install11/scene", { recursive: true });
writeFileSync("docs/verification/install11/scene/kits.json.gz", gzipSync(JSON.stringify(state)));
writeFileSync("docs/verification/install11/scene/kits-placed.json", JSON.stringify(placed, null, 1) + "\n");
console.log(placed.map(p => `${p.kind}:${p.stage}@${p.tx},${p.ty}`).join(" "));
