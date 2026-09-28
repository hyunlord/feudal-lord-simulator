// INSTALL-3 UI capture states (current-format bare states, the scene injection admits them), from the C4 human path
// (tests/humanPathAle.test.ts): the palisade-construction town in chapter 2, a barn to barley and a malt kiln placed
// through the reducer, then the world left to run. No state is edited between the commands. The moments:
//  - barn-wheat: chapter 2 set, before any command (the barn's crop select on wheat, the houses unserved by ale);
//  - barn-barley: right after `set_farmstead_crop` (the select on barley, with its note);
//  - barley-held, malt-held: the first tick a barn holds barley, then the kiln malt (the stores, the ledger);
//  - sold: the first ale sold by an alehouse; served: the first tick after it that a house rising is served by ale;
//  - season-before: 60 ticks before the first season closes after the first malt (the season card opens on it);
// The bot's label needs a town where the bot itself turns a barn: scripts/install3BotState.ts (this town's bot never
// reaches the ale chain in 12,000 ticks: its wall and fields come first).
// Beside them moments.json (tick, year, the ids the captures look at). Deterministic.
//   npx tsx scripts/install3UiStates.ts <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { CHAPTER_TWO } from "../src/content/chapterConfig";
import { aleServedHouses } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import { initialPolitics } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { buildingCauseSnapshot } from "../src/ui/houseProgressModel";
import { canPlaceBuilding } from "../src/world/placement";

const [out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const moments: Record<string, Record<string, unknown>> = {};
const save = (name: string, state: GameState, about: Record<string, unknown> = {}) => {
  if (moments[name] !== undefined) return;
  moments[name] = { tick: state.tick, year: stateCalendar(state).year, season: stateCalendar(state).season, ...about };
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick}\n`);
};
const houseWith = (state: GameState, served: boolean) => [...buildingCauseSnapshot(state).values()]
  .find(model => "currentLevel" in model && model.status === "ready" && model.ale !== undefined && model.ale.served === served)?.buildingId ?? null;

const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
const politics = initialPolitics(saved);
let state: GameState = { ...saved, politics: { ...politics, chapter: { ...politics.chapter, number: CHAPTER_TWO.chapter } } };
const barns = state.buildings.filter(building => building.kind === "farmstead").sort((a, b) => a.id.localeCompare(b.id));
const barn = barns[0]!;
const spot = state.tiles.find(tile => canPlaceBuilding(state, "malt_kiln", tile.tx, tile.ty).ok && Math.abs(tile.tx - barn.tx) + Math.abs(tile.ty - barn.ty) < 14)!;
save("barn-wheat", state, { barn: barn.id, barnTile: [barn.tx, barn.ty], kilnSpot: [spot.tx, spot.ty], unservedHouse: houseWith(state, false) });

state = gameReducer(state, { type: "set_farmstead_crop", buildingId: barn.id, crop: "barley" });
save("barn-barley", state, { barn: barn.id, barnTile: [barn.tx, barn.ty] });
state = gameReducer(state, { type: "place_building", kind: "malt_kiln", tx: spot.tx, ty: spot.ty });
const SEASON = PRESSURE_BALANCE.seasonTicks;
for (let step = 0; step < 6000 && !(moments.sold !== undefined && moments.served !== undefined && moments["season-before"] !== undefined); step += 1) {
  state = advanceTick(state);
  const kiln = state.buildings.find(building => building.kind === "malt_kiln");
  const barnNow = state.buildings.find(building => building.id === barn.id)!;
  if ((barnNow.inventory.barley ?? 0) > 0) save("barley-held", state, { barn: barn.id, barnTile: [barn.tx, barn.ty], barley: barnNow.inventory.barley });
  if (kiln !== undefined && (kiln.inventory.malt ?? 0) > 0) save("malt-held", state, { kiln: kiln.id, kilnTile: [kiln.tx, kiln.ty], malt: kiln.inventory.malt, barley: kiln.inventory.barley ?? 0 });
  if (moments["malt-held"] !== undefined && (state.tick + 60) % SEASON === 0) save("season-before", state, { closesAt: state.tick + 60 });
  const sold = (state.ledger?.entries ?? []).some(entry => entry.category === "stall_fee" && entry.sourceRefs.some(ref => String(ref.detail ?? "").startsWith("alehouse:")));
  if (sold) save("sold", state, { served: aleServedHouses(state).size });
  // The costlier look (every house's progress) every 20 ticks.
  if (state.tick % 20 !== 0) continue;
  if (moments.sold !== undefined) {
    const served = houseWith(state, true);
    if (served !== null) { const home = state.buildings.find(building => building.id === served)!; save("served", state, { house: served, houseTile: [home.tx, home.ty], unservedHouse: houseWith(state, false) }); }
  }
}
writeFileSync(join(out!, "moments.json"), `${JSON.stringify(moments, null, 1)}\n`);
const wanted = ["barn-wheat", "barn-barley", "barley-held", "malt-held", "season-before", "sold", "served"];
const missing = wanted.filter(name => moments[name] === undefined);
console.log(JSON.stringify({ found: Object.fromEntries(Object.entries(moments).map(([name, about]) => [name, about.tick])), missing }));
process.exitCode = missing.length === 0 ? 0 : 1;
