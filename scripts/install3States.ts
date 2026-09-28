// INSTALL-3 world captures' states: the C4 human path (tests/humanPathAle.test.ts) replayed — the v22 palisade town in
// chapter 2, its first barn set to barley and a malt kiln placed (two game commands through the reducer, nothing edited
// after), then the world left to run — and the first tick of each moment the captures look at written as a bare
// GameState: <dir>/<moment>.json, with <dir>/moments.json (tick, the tile to centre on, what is there).
//   npx tsx scripts/install3States.ts <dir> [--ticks 16000]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHAPTER_TWO } from "../src/content/chapterConfig";
import { brewingSlot, isAlehouse } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import { initialPolitics } from "../src/engine/politics";
import { advanceTick } from "../src/engine/tick";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { residentWalkers } from "../src/render/presentation/residentTrips";
import { millOvenBurning } from "../src/render/roofSmoke";
import { brewingDoor } from "../src/render/villageLife";
import { wetSummer } from "../src/render/wetSummer";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { canPlaceBuilding } from "../src/world/placement";
import { arableStripStates } from "../src/zones/arableStrips";
import { zonesOf } from "../src/zones/zoneEdits";

const [dir] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const TICKS = Number(flag("ticks") ?? 16_000);
if (dir === undefined) throw new Error("usage: install3States.ts <dir> [--ticks N]");
mkdirSync(dir, { recursive: true });

const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
const politics = initialPolitics(saved);
let state: GameState = { ...saved, politics: { ...politics, chapter: { ...politics.chapter, number: CHAPTER_TWO.chapter } } };
const barn = state.buildings.filter(building => building.kind === "farmstead").sort((a, b) => a.id.localeCompare(b.id))[0]!;
state = gameReducer(state, { type: "set_farmstead_crop", buildingId: barn.id, crop: "barley" });
const spot = state.tiles.find(tile => canPlaceBuilding(state, "malt_kiln", tile.tx, tile.ty).ok && Math.abs(tile.tx - barn.tx) + Math.abs(tile.ty - barn.ty) < 14)!;
state = gameReducer(state, { type: "place_building", kind: "malt_kiln", tx: spot.tx, ty: spot.ty });
const commandTick = state.tick;

type Moment = { readonly tick: number; readonly tile: readonly [number, number]; readonly note: string };
const moments: Record<string, Moment> = {};
const centre = (building: { readonly kind: string; readonly tx: number; readonly ty: number; readonly houseLot?: unknown }) => {
  const size = buildingFootprint(building as Parameters<typeof buildingFootprint>[0]);
  return [building.tx + (size.width - 1) / 2, building.ty + (size.height - 1) / 2] as const;
};
const take = (name: string, tile: readonly [number, number] | null, note: string) => {
  if (moments[name] !== undefined || tile === null) return;
  moments[name] = { tick: state.tick, tile, note };
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(state));
};

function strips(stage: string, crop: "wheat" | "barley") {
  return zonesOf(state).filter(zone => zone.kind === "arable").flatMap(zone => arableStripStates(zone, state).strips)
    .filter(strip => strip.crop === crop && strip.stage === stage);
}
const cellsMiddle = (cells: readonly { readonly tx: number; readonly ty: number }[]) =>
  [cells.reduce((sum, cell) => sum + cell.tx, 0) / cells.length, cells.reduce((sum, cell) => sum + cell.ty, 0) / cells.length] as const;

for (let step = 0; step < TICKS && Object.keys(moments).length < 11; step += 1) {
  state = advanceTick(state);
  const kiln = state.buildings.find(building => building.kind === "malt_kiln");
  for (const stage of ["growing", "ripe"] as const) {
    const barleyStrips = strips(stage, "barley");
    // A wet summer blights both crops' growing and ripe strips alike (UI-4): those years show no crop, so wait for a dry one.
    if (barleyStrips.length === 0 || moments[`barley-${stage}`] !== undefined || wetSummer(state)) continue;
    // Centred between the closest barley and wheat strips of the same stage (when within 10 tiles), so the crop holds both.
    const wheatAt = strips(stage, "wheat").map(strip => cellsMiddle(strip.cells));
    const pairs = barleyStrips.map(strip => cellsMiddle(strip.cells)).flatMap(barleyAt => wheatAt.map(wheat => ({ barleyAt, wheat, gap: Math.hypot(wheat[0] - barleyAt[0], wheat[1] - barleyAt[1]) })))
      .sort((a, b) => a.gap - b.gap);
    const pair = pairs[0];
    const barleyAt = pair?.barleyAt ?? cellsMiddle(barleyStrips[0]!.cells);
    const near = pair !== undefined && pair.gap <= 10;
    const at = (point: readonly [number, number]) => `(${point.map(value => value.toFixed(1)).join(", ")})`;
    take(`barley-${stage}`, near ? [(barleyAt[0] + pair.wheat[0]) / 2, (barleyAt[1] + pair.wheat[1]) / 2] : barleyAt,
      `${barleyStrips.length} barley strips ${stage}; the barley strip at ${at(barleyAt)} beside the wheat strip ${stage} at ${pair === undefined ? "none" : at(pair.wheat)}`);
  }
  if (kiln !== undefined && millOvenBurning(kiln) && (kiln.inventory.malt ?? 0) > 0) take("kiln-working", centre(kiln), `kiln barley ${kiln.inventory.barley ?? 0}, malt ${kiln.inventory.malt ?? 0}, workers ${kiln.workers}`);
  // The kiln's carts take its malt to the granary a sack or so at a time, so its pile stays at level 1 (of 40).
  const barley = state.buildings.find(building => building.kind === "farmstead" && (building.inventory.barley ?? 0) > 0);
  if (barley !== undefined) take("barn-barley", centre(barley), `barn ${barley.id} barley ${barley.inventory.barley} (capacity 1000: pile level 1 below 334), wheat ${barley.inventory.wheat ?? 0}`);
  for (const house of state.houses) {
    const ale = brewingSlot(house)?.stock.ale ?? 0;
    const building = state.buildings.find(candidate => candidate.id === house.buildingId);
    if (building === undefined) continue;
    if (ale >= 1 && !isAlehouse(house) && brewingDoor(state, house.buildingId) !== null) take("brewing", centre(building), `house ${house.buildingId} level ${house.level}, ale ${ale}`);
    if (isAlehouse(house) && building.houseLot === undefined && house.level === 2) {
      if (ale > 0) take("alehouse", centre(building), `alehouse ${house.buildingId} ale ${ale}`);
      else take("alehouse-dry", centre(building), `alehouse ${house.buildingId} sold out`);
    }
  }
  for (const walker of state.walkers) {
    const resource = walker.cargo?.resource;
    if (walker.kind === "carter" && (resource === "barley" || resource === "malt" || resource === "ale")) {
      const home = state.buildings.find(building => building.id === walker.homeBuildingId);
      take(`cart-${resource}`, [walker.position.tx, walker.position.ty], `carter ${walker.id} (${home?.kind ?? "?"}) with ${walker.cargo!.amount} ${resource}`);
    }
  }
  if (step % 5 === 0) {
    const residents = residentWalkers(state);
    const alewife = residents.find(walker => walker.resident.purpose === "malt");
    if (alewife !== undefined) take("alewife", [alewife.position.tx, alewife.position.ty], `alewife ${alewife.id}`);
    const maltster = residents.find(walker => walker.resident.purpose === "kiln");
    if (maltster !== undefined) take("maltster", [maltster.position.tx, maltster.position.ty], `maltster ${maltster.id}`);
  }
}
writeFileSync(join(dir, "moments.json"), JSON.stringify({ fixture: "fixtures/saves/v22/palisade-construction.save.json", barn: barn.id, kilnSpot: spot, commandTick, moments }, null, 1) + "\n");
console.log(JSON.stringify({ commandTick, moments }, null, 1));
