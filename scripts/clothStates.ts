// CLOTH-UI gate states (current-format bare states, the scene injection admits them): C5's human path — the town
// that came through chapters 1–3 (fixture chapter-four-town, tests/humanPathCloth.test.ts), game commands only (two
// pasture strokes, the pastoral farm, the weaver's house, the fulling mill, the dyehouse, the tenter yard), then the
// world runs. Saved: right after the commands, when the five buildings stand, and the first tick of each stage —
// shorn fleece, yarn, raw cloth, fulled, dyed, finished, the first sale (the first `ulnage` ledger entry) — and a
// season after the sale. Beside them moments-cloth.json (the tick, year and where each is). Deterministic.
//   tsx scripts/clothStates.ts <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { clothTown, paintPasture, placeNear } from "../tests/helpers/clothTown";

const [out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const found = new Map<string, Record<string, unknown>>();
const save = (name: string, state: GameState, about: Record<string, unknown> = {}) => {
  if (found.has(name)) return;
  found.set(name, { tick: state.tick, year: stateCalendar(state).year, ...about });
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick} (${stateCalendar(state).year})\n`);
};
const KINDS = ["pastoral_farm", "weaver_house", "fulling_mill", "dyehouse", "tenter_yard"] as const;
const holder = (state: GameState, resource: string) => state.buildings.find(building => (building.inventory[resource as "fleece"] ?? 0) > 0);
const at = (building: { readonly id: string; readonly kind: string; readonly tx: number; readonly ty: number } | undefined) =>
  building === undefined ? {} : { building: building.id, kind: building.kind, tile: [building.tx, building.ty] };

let state: GameState = clothTown();
const store = state.buildings.filter(building => building.kind === "storehouse").sort((a, b) => a.id.localeCompare(b.id))[0]!;
state = paintPasture(paintPasture(state, store), store);
const pasture = (state.zones ?? []).filter(zone => zone.kind === "pasture").flatMap(zone => zone.membership);
const middle = { tx: Math.round(pasture.reduce((sum, index) => sum + index % state.width, 0) / pasture.length),
  ty: Math.round(pasture.reduce((sum, index) => sum + Math.floor(index / state.width), 0) / pasture.length) };
state = placeNear(state, "pastoral_farm", middle);
for (const kind of KINDS.slice(1)) state = placeNear(state, kind, store);
save("c0-commands", state, { pastureCells: pasture.length, pastureMiddle: [middle.tx, middle.ty] });
const STAGES = [["c2-fleece", "fleece"], ["c3-yarn", "yarn"], ["c4-woven", "raw_cloth"], ["c5-fulled", "fulled_cloth"], ["c6-dyed", "dyed_cloth"], ["c7-finished", "finished_cloth"]] as const;
let soldTick: number | null = null;
for (let step = 0; step < 12_000; step += 1) {
  state = advanceTick(state);
  if (KINDS.every(kind => state.buildings.some(building => building.kind === kind))) {
    save("c1-built", state, Object.fromEntries(KINDS.map(kind => [kind, at(state.buildings.find(building => building.kind === kind))])));
  }
  for (const [name, resource] of STAGES) { const where = holder(state, resource); if (where !== undefined) save(name, state, at(where)); }
  if (soldTick === null && (state.ledger?.entries ?? []).some(entry => entry.category === "ulnage")) {
    soldTick = state.tick;
    save("c8-first-sale", state, at(state.buildings.find(building => building.kind === "tenter_yard")));
  }
  if (soldTick !== null && state.tick >= soldTick + 1_000) { save("c9-season-after", state); break; }
}
writeFileSync(join(out!, "moments-cloth.json"), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
const missing = ["c0-commands", "c1-built", ...STAGES.map(([name]) => name), "c8-first-sale", "c9-season-after"].filter(name => !found.has(name));
console.log(JSON.stringify({ found: Object.fromEntries([...found].map(([name, about]) => [name, about.tick])), missing }));
process.exit(missing.length === 0 ? 0 : 1);
