// F0-V gate 2 scene: three building sites on the new-game map, one per blocker the plaque shows: no builders
// (materials in, nobody free), no material in any store (the stores emptied; the treasury keeps timber so the road cut reads as a road cut), and a road cut (a site with
// no road anywhere near), plus a second no-builders site beside the first (zoomed out the two share one icon).
// Written for scripts/visibilityCaptures.mjs.
//   tsx scripts/visibilityScenes.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createConstructionSite } from "../src/economy/construction";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

const base = DEFAULT_GAME_STATE;
const site = (ordinal: number, kind: "well" | "farmstead" | "storehouse" | "house", tx: number, ty: number) => createConstructionSite({ ordinal, kind, tx, ty, startedTick: 0 });
const noBuilders = { ...site(901, "well", 47, 38), delivered: { timber: 10 }, stall: "no_builders" as const };
const noBuildersToo = { ...site(904, "house", 50, 37), delivered: { timber: 10 }, stall: "no_builders" as const };
const noMaterial = { ...site(902, "farmstead", 50, 41), stall: "no_material_source" as const };
const roadCut = { ...site(903, "storehouse", 43, 44), stall: "no_route" as const };
const state = { ...base, treasuryTimber: 60, buildings: base.buildings.map(building => ({ ...building, inventory: {} })),
  constructionSites: [noBuilders, noMaterial, roadCut, noBuildersToo] };
mkdirSync("docs/verification/f0v-visible-construction/scene", { recursive: true });
writeFileSync("docs/verification/f0v-visible-construction/scene/blockers.json.gz", gzipSync(JSON.stringify(state)));
console.log(JSON.stringify(state.constructionSites.map(item => ({ id: item.id, kind: item.kind, tx: item.tx, ty: item.ty, stall: item.stall }))));
