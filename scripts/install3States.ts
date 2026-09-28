// INSTALL-3 gate ①: the human path of the ale chain as states (the C4 test tests/humanPathAle.test.ts, replayed): the
// v22 palisade-construction save set to chapter 2, two game commands through the reducer — the first barn to barley
// (set_farmstead_crop) and a malt kiln placed near it (place_building) — then the world left to run until an alehouse
// has sold ale. No state is edited between the commands. Each moment's first tick is written as a GameState JSON
// (the format scripts/renderCommitProbe.mjs openScene takes) with moments.json (tick and the buildings to look at).
//   npx tsx scripts/install3States.ts <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHAPTER_TWO } from "../src/content/chapterConfig";
import { alehouses, brewingSlot } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import { initialPolitics } from "../src/engine/politics";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { canPlaceBuilding } from "../src/world/placement";

const [out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
const politics = initialPolitics(saved);
let state: GameState = { ...saved, politics: { ...politics, chapter: { ...politics.chapter, number: CHAPTER_TWO.chapter } } };
const barn = state.buildings.filter(building => building.kind === "farmstead").sort((a, b) => a.id.localeCompare(b.id))[0]!;
const moments: Record<string, Record<string, unknown>> = {};
const write = (name: string, about: Record<string, unknown>) => {
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  moments[name] = { tick: state.tick, ...about };
  console.log(name, state.tick, JSON.stringify(about));
};
write("m0-before", { barn: barn.id, crop: barn.crop ?? "wheat" });
state = gameReducer(state, { type: "set_farmstead_crop", buildingId: barn.id, crop: "barley" });
write("m1-barn-barley", { barn: barn.id });
const spot = state.tiles.find(tile => canPlaceBuilding(state, "malt_kiln", tile.tx, tile.ty).ok && Math.abs(tile.tx - barn.tx) + Math.abs(tile.ty - barn.ty) < 14)!;
state = gameReducer(state, { type: "place_building", kind: "malt_kiln", tx: spot.tx, ty: spot.ty });
write("m2-kiln-site", { barn: barn.id, kilnAt: [spot.tx, spot.ty] });
const kiln = () => state.buildings.find(building => building.kind === "malt_kiln");
const strips = () => (state.arableFields ?? []).flatMap(field => field.strips.filter(strip => strip.crop === "barley"));
const brewing = () => state.houses.find(house => { const slot = brewingSlot(house); return slot !== null && ((slot.stock.ale ?? 0) > 0 || (slot.stock.malt ?? 0) > 0); });
const aleSold = () => (state.ledger?.entries ?? []).some(entry => entry.category === "stall_fee" && entry.sourceRefs.some(ref => String(ref.detail ?? "").startsWith("alehouse:")));
const CHECKS: readonly [string, () => Record<string, unknown> | null][] = [
  ["m3-barley-sown", () => strips().some(strip => strip.stage === "sown" || strip.stage === "growing") ? { barn: barn.id, strips: strips().length } : null],
  ["m4-barley-growing", () => strips().some(strip => strip.stage === "growing") ? { barn: barn.id } : null],
  ["m5-barley-ripe", () => strips().some(strip => strip.stage === "ripe") ? { barn: barn.id } : null],
  ["m6-kiln-built", () => kiln() === undefined ? null : { kiln: kiln()!.id }],
  ["m7-barley-in-barn", () => (state.buildings.find(building => building.id === barn.id)?.inventory.barley ?? 0) > 0 ? { barn: barn.id, barley: state.buildings.find(building => building.id === barn.id)!.inventory.barley } : null],
  ["m8-malt", () => (kiln()?.inventory.malt ?? 0) > 0 ? { kiln: kiln()!.id, malt: kiln()!.inventory.malt } : null],
  ["m9-brewing", () => { const house = brewing(); return house === undefined ? null : { house: house.buildingId, slot: brewingSlot(house)!.stock }; }],
  ["m10-alehouse", () => alehouses(state).some(id => (brewingSlot(state.houses.find(house => house.buildingId === id)!)?.stock.ale ?? 0) > 0) ? { alehouse: alehouses(state)[0] } : null],
  ["m11-ale-sold", () => aleSold() ? { alehouses: alehouses(state) } : null],
];
for (let step = 0; step < 6_000 && moments["m11-ale-sold"] === undefined; step += 1) {
  state = advanceTick(state);
  for (const [name, check] of CHECKS) {
    if (moments[name] !== undefined) continue;
    const about = check();
    if (about !== null) write(name, about);
  }
}
writeFileSync(join(out!, "moments.json"), JSON.stringify(moments, null, 1) + "\n");
const missing = CHECKS.map(([name]) => name).filter(name => moments[name] === undefined);
console.log(JSON.stringify({ moments: Object.keys(moments).length, missing }));
process.exitCode = missing.length === 0 ? 0 : 1;
