// INSTALL-18 (Wave 18 HUD) capture states, from the save fixtures (fixtures/saves/v<schema>, read through the codec):
//  - crisis-a: zone-undo (its five sites wait for workers: "공사 일꾼 없음") at tick 40 (rows show from tick 20), one house
//    on fire (events.burning) and another getting ready to leave (leavingSinceTick) — fire / household_leaving /
//    construction_blocked;
//  - crisis-b: population-176 with one facility's upkeep unpaid (upkeepUnpaid) and one storehouse holding more than it
//    can (inventory over storageCapacity) beside its own bread-short houses — upkeep_unpaid / storage_full / food_shortage;
//  - lord: the lord's slice (core:lord_slice) after 40 ticks, for the dock's 명령 (lord mode);
//  - placement scenes: for each placement reason the HUD pictures, the first (fixture, kind, tile) whose placement
//    preview (render/interactions placementPreview, the game's own verdict) marks that reason, nearest the town's
//    starting house — written to scenes.json with the fixture file to load.
// The crisis states are edited fixtures (capture input only); each one's rows are checked here with alertStackRows.
//   tsx scripts/in18HudStates.ts <out-dir>
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { lordMode } from "../src/engine/townAgency";
import { placementPreview } from "../src/render/interactions";
import type { TileMarkReason } from "../src/render/placementTileMarks";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { newGameState } from "../src/state/newGame";
import { alertStackRows, type AlertCrisis } from "../src/ui/alertStackModel";
import { buildCategory } from "../src/ui/buildMenuPresentation";
import { loadSaveFile } from "./loadSaveFile";

const outArg = process.argv[2];
if (outArg === undefined) throw new Error("usage: tsx scripts/in18HudStates.ts <out-dir>");
const out: string = outArg;
mkdirSync(out, { recursive: true });
const FIXTURES = `fixtures/saves/v${SAVE_SCHEMA_VERSION}`;
const load = (name: string): GameState => loadSaveFile(join(FIXTURES, `${name}.save.json`));
const crises = (state: GameState): readonly (AlertCrisis | null)[] => alertStackRows(state).map(row => row.crisis);
const about: Record<string, unknown> = {};
const EMPTY_EVENTS: NonNullable<GameState["events"]> = { records: [], burning: [] };

function write(name: string, state: GameState, want: readonly AlertCrisis[] | null): void {
  if (want !== null) {
    const got = crises(state);
    if (want.some(kind => !got.includes(kind))) throw new Error(`${name}: rows ${JSON.stringify(alertStackRows(state).map(row => [row.title, row.crisis]))}, want ${want.join(", ")}`);
    about[name] = alertStackRows(state).map(row => ({ title: row.title, severity: row.severity, crisis: row.crisis, first: row.targetIds[0] }));
  }
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
}

{
  const base = load("zone-undo");
  const houses = base.houses.filter(house => house.abandonedTick === undefined);
  const [burning, leaving] = houses;
  if (burning === undefined || leaving === undefined) throw new Error("zone-undo: two houses needed");
  const state: GameState = {
    ...base, tick: 40,
    events: { ...(base.events ?? EMPTY_EVENTS), burning: [{ buildingId: burning.buildingId, eventId: "in18-capture-fire", ignitedTick: 30, outTick: 400, doused: false }] },
    houses: base.houses.map(house => house.buildingId === leaving.buildingId ? { ...house, leavingSinceTick: 30 } : house),
  };
  write("crisis-a", state, ["fire", "household_leaving", "construction_blocked"]);
}
{
  const base = load("population-176");
  const facility = base.buildings.find(building => building.kind !== "house" && BUILDING_CONFIG_BY_KIND[building.kind].production !== null);
  const store = base.buildings.find(building => building.kind === "storehouse");
  if (facility === undefined || store === undefined) throw new Error("population-176: a facility and a storehouse needed");
  const capacity = BUILDING_CONFIG_BY_KIND.storehouse.storageCapacity;
  const state: GameState = { ...base, buildings: base.buildings.map(building => building.id === facility.id ? { ...building, upkeepUnpaid: true as const }
    : building.id === store.id ? { ...building, inventory: { ...building.inventory, timber: capacity + 12 } } : building) };
  write("crisis-b", state, ["upkeep_unpaid", "storage_full", "food_shortage"]);
}
{
  let state = newGameState({ scenarioId: "core:lord_slice" })!;
  while (state.tick < 40) state = advanceTick(state);
  if (!lordMode(state)) throw new Error("lord slice is not in lord mode");
  write("lord", state, null);
}

// Placement scenes: the reasons with a Wave 18 picture, and `road` (keeps its P0 icon: a road lies on the tile).
const WANT: readonly TileMarkReason[] = ["building", "water", "wall", "needs_road", "materials", "zone", "road"];
const SEARCH: readonly { readonly fixture: string; readonly kinds: readonly BuildingKind[] }[] = [
  { fixture: "population-176", kinds: ["storehouse", "house", "well", "market"] },
  { fixture: "zoned-opening", kinds: ["house", "wheat_farm", "farmstead"] },
  { fixture: "timber-shortage", kinds: ["storehouse", "market", "house"] },
  { fixture: "palisade-construction", kinds: ["house", "storehouse", "market"] },
  { fixture: "chapter-two-town", kinds: ["house", "storehouse", "market", "well"] },
];
const scenes: { reason: TileMarkReason; fixture: string; kind: BuildingKind; name: string; category: string; tile: { tx: number; ty: number } }[] = [];
for (const reason of WANT) {
  let found = null as (typeof scenes)[number] | null;
  for (const { fixture, kinds } of SEARCH) {
    const state = load(fixture);
    const home = state.buildings.find(building => building.kind === "house") ?? state.buildings[0]!;
    let best: { d: number; kind: BuildingKind; tile: { tx: number; ty: number } } | null = null;
    for (const kind of kinds) for (let dy = -14; dy <= 14; dy += 1) for (let dx = -14; dx <= 14; dx += 1) {
      const tile = { tx: home.tx + dx, ty: home.ty + dy };
      const marks = placementPreview(state, kind, tile, null).marks ?? [];
      if (!marks.some(mark => mark.icon && mark.reason === reason)) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      if (best === null || d < best.d) best = { d, kind, tile };
    }
    if (best !== null) { found = { reason, fixture, kind: best.kind, name: BUILDING_CONFIG_BY_KIND[best.kind].name, category: buildCategory(best.kind), tile: best.tile }; break; }
  }
  if (found === null) { about[`scene-${reason}`] = "not found in the searched fixtures"; continue; }
  scenes.push(found);
}
for (const fixture of new Set(scenes.map(scene => scene.fixture))) copyFileSync(join(FIXTURES, `${fixture}.save.json`), join(out, `${fixture}.save.json`));
writeFileSync(join(out, "scenes.json"), JSON.stringify({ scenes, about }, null, 1) + "\n");
console.log(JSON.stringify({ scenes, about }, null, 1));
