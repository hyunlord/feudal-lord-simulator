// LAND-UI works evidence states (Wave 34): save envelopes for scripts/landWorksCaptures.ts.
//  - coast-ford-{summer,winter}: the coast, seed 1, a road laid across its first two-cell ford group (and onto both
//    banks), a walker standing on the ford (the splash);
//  - downs-ford1-summer: the downs, seed 3, a road across a single-cell ford (LU-D4, the w2 sheet on one cell);
//  - fen-works-a-{summer,winter}: the fen, seed 1, works at stage 1 (men digging) and stage 3, and a finished patch;
//  - fen-works-b-summer: the same with the stage-1 works at stage 2.
// Their camera tiles go to tiles.json (with `fen-tool-grass`, the grass tile the refusal hovers). Light (no bot run): npx tsx scripts/landWorksStates.ts <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COASTAL_ARCHETYPE_ID, DOWNS_ARCHETYPE_ID, FEN_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { drainagePlan, startDrainage } from "../src/engine/drainage";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { fordGroups } from "../src/render/landWorksModel";
import { encodeSave } from "../src/save/saveCodec";
import { newGameState } from "../src/state/newGame";

const [out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const FIXED = "2026-10-01T00:00:00.000Z";
const SUMMER = 1_200, WINTER = 3_200;

function opening(archetypeId: string): GameState {
  let state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId, seed: 1 });
  if (state === null) throw new Error(archetypeId);
  for (let tick = 0; tick < 20; tick += 1) state = advanceTick(state);
  return state;
}
const tiles: Record<string, readonly [number, number]> = {};
function save(name: string, state: GameState, tile: readonly [number, number]): void {
  tiles[name] = tile;
  writeFileSync(join(out!, `${name}.json`), encodeSave({ state, createdAt: FIXED, savedAt: FIXED, gameVersion: "0.1.0+landui-works" }).bytes);
  console.log(JSON.stringify({ name, tick: state.tick, tile }));
}
const at = (state: GameState, tick: number): GameState => ({ ...state, tick });

/** A road across a ford group, one bank cell beyond each end; a walker parked on the ford's first cell. */
function fordRoad(state: GameState, pick: (group: ReturnType<typeof fordGroups>[number]) => boolean): { state: GameState; tile: readonly [number, number] } {
  const group = fordGroups(state).find(pick)!;
  const { width } = state;
  const step = group.axis === "nw" ? 1 : width;
  const road = new Set([...group.cells, group.cells[0]! - step, group.cells.at(-1)! + step, group.cells[0]! - 2 * step, group.cells.at(-1)! + 2 * step]);
  const tiles = state.tiles.map((tile, index) => road.has(index) && (tile.terrain === "grass" || tile.terrain === "water") ? { ...tile, hasRoad: true } : tile);
  const first = group.cells[0]!;
  const walkers = state.walkers.length === 0 ? state.walkers
    : [{ ...state.walkers[0]!, position: { tx: first % width, ty: Math.floor(first / width) } }, ...state.walkers.slice(1)];
  return { state: { ...state, tiles, walkers }, tile: [Math.round(group.centre.tx), Math.round(group.centre.ty)] };
}

const coast = fordRoad(opening(COASTAL_ARCHETYPE_ID), group => group.width === 2);
save("coast-ford-summer", at(coast.state, SUMMER), coast.tile);
save("coast-ford-winter", at(coast.state, WINTER), coast.tile);
// A single-cell ford away from the map's edge (seed 1's first lies on the edge; seed 3's at (44, 21)).
const downsSeed3 = (() => { let state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: DOWNS_ARCHETYPE_ID, seed: 3 })!;
  for (let tick = 0; tick < 20; tick += 1) state = advanceTick(state); return state; })();
const downs = fordRoad(downsSeed3, group => group.width === 1 && group.centre.tx > 4 && group.centre.tx < 59);
save("downs-ford1-summer", at(downs.state, SUMMER), downs.tile);

// The fen: three meres close together (the first's plan near the map's middle, the others nearest it).
let fen: GameState = { ...opening(FEN_ARCHETYPE_ID), treasuryTimber: 2_000 };
const plans = fen.tiles.filter(tile => tile.terrain === "water").flatMap(tile => {
  const plan = drainagePlan(fen, tile.tx, tile.ty);
  return plan.ok && plan.cells.length >= 9 ? [{ tx: tile.tx, ty: tile.ty, cells: plan.cells }] : [];
});
const centre = { tx: fen.width / 2, ty: fen.height / 2 };
plans.sort((a, b) => Math.hypot(a.tx - centre.tx, a.ty - centre.ty) - Math.hypot(b.tx - centre.tx, b.ty - centre.ty));
const chosen = [plans[0]!];
for (const plan of [...plans].sort((a, b) => Math.hypot(a.tx - chosen[0]!.tx, a.ty - chosen[0]!.ty) - Math.hypot(b.tx - chosen[0]!.tx, b.ty - chosen[0]!.ty))) {
  if (chosen.length < 3 && chosen.every(other => !other.cells.some(cell => plan.cells.includes(cell)) && Math.hypot(plan.tx - other.tx, plan.ty - other.ty) >= 5)) chosen.push(plan);
}
if (chosen.length < 3) throw new Error("three meres");
const [one, two, three] = chosen as [typeof plans[number], typeof plans[number], typeof plans[number]];
// The finished patch: its cells turned to meadow and recorded as drained (what advanceDrainage leaves).
const dry = new Set(three.cells);
fen = { ...fen, tiles: fen.tiles.map((tile, index) => dry.has(index) ? { ...tile, terrain: "grass" as const } : tile), drainage: { works: [], drained: [...three.cells] } };
fen = startDrainage(startDrainage(fen, one.tx, one.ty), two.tx, two.ty);
const works = (firstDone: number) => fen.drainage!.works.map((work, index) => index === 0
  ? { ...work, workDone: Math.round(work.workNeeded * firstDone), diggers: 4 } : { ...work, workDone: Math.round(work.workNeeded * 0.8) });
const view: [number, number] = [Math.round((one.tx + two.tx + three.tx) / 3), Math.round((one.ty + two.ty + three.ty) / 3)];
const stageA = { ...fen, drainage: { ...fen.drainage!, works: works(0.1) } };
save("fen-works-a-summer", at(stageA, SUMMER), view);
save("fen-works-a-winter", at(stageA, WINTER), view);
save("fen-works-b-summer", at({ ...fen, drainage: { ...fen.drainage!, works: works(0.5) } }, SUMMER), view);
// The drain tool's hover: a fresh fen (no works), a mere's tile and a grass tile beside it.
const fresh = { ...opening(FEN_ARCHETYPE_ID) };
save("fen-tool-summer", at(fresh, SUMMER), [one.tx, one.ty]);
const grass = fresh.tiles.find(tile => tile.terrain === "grass" && Math.abs(tile.tx - one.tx) + Math.abs(tile.ty - one.ty) <= 3)!;
tiles["fen-tool-grass"] = [grass.tx, grass.ty];
writeFileSync(join(out!, "tiles.json"), `${JSON.stringify(tiles)}\n`);
console.log(JSON.stringify({ mere: [one.tx, one.ty], cells: one.cells.length, second: [two.tx, two.ty], drained: [three.tx, three.ty] }));
