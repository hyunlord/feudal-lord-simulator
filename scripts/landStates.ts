// LAND-UI gate states (from scripts/nat1LandStates.ts): a grown town on each of the five lands (ARCH-1, seed 1) — a new
// game, then the guardrail bot's autoplay for `ticks` ticks and on to the middle of the next summer (tick % 4000 = 1500)
// and of the winter after it (3500), so the season art follows the tick as in play (stateCalendar; no tick is edited) —
// written as current-format bare states `<land>-summer.json` / `<land>-winter.json`. Beside them:
//  - `fen_drainage-works-{summer,winter}.json`: the fen town's summer with three drainage works by the town (MA-11), each
//    commanded through the store's reducer (`drain_fen`): one finished (advanceDrainage: its cells meadow, in
//    `drainage.drained`), one at 20 % of its work (stage 1 staked, LU-D5) and one at 80 % with its diggers (stage 3
//    drying). The timber they cost is added to the treasury first. The winter copy is the same town 2,000 ticks on.
//  - `chalk_downs-ford-{summer,winter}.json`: the downs town's summer with a road across the brook's nearest ford group of
//    each width (1 and 2 cells; FD-1, `place_road_line`), or the bot's own ford road when it laid one.
//  - manifest.json: per state its tick, season and focus tiles (the town centre and the land's character: the riverside's
//    river, the coast's shore, the downs' walled fields, the forest's edge, the fen's meres) for scripts/landCaptures.ts.
//  - with --perf-fixture <file.save.json.gz>: the fen works summer as a save file (encodeSave, gzip), perf:gate's
//    land-fen-works-x3 scene (fixtures/perf-gate/fen_drainage-works.save.json.gz).
//   npx tsx scripts/landStates.ts <out-dir> [ticks=30000] [--perf-fixture <file>]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { advanceDrainage, drainagePlan } from "../src/engine/drainage";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { mapArchetypes, newGameState } from "../src/state/newGame";
import { isFordCell, isFordRoad } from "../src/world/bridges";
import { isFlowingWater } from "../src/world/river";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";

export type Tile = { readonly tx: number; readonly ty: number };
export const SEASON_TICK = { summer: 1_500, winter: 3_500 } as const;
const YEAR = 4_000;
const NEIGHBOURS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const chebyshev = (a: Tile, b: Tile) => Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty));
const tileOf = (state: GameState, index: number): Tile => ({ tx: index % state.width, ty: Math.floor(index / state.width) });
const terrainAt = (state: GameState, tx: number, ty: number) =>
  tx < 0 || ty < 0 || tx >= state.width || ty >= state.height ? undefined : state.tiles[ty * state.width + tx]!.terrain;
const nearest = <T extends Tile>(from: Tile, tiles: readonly T[]) =>
  [...tiles].sort((a, b) => Math.hypot(a.tx - from.tx, a.ty - from.ty) - Math.hypot(b.tx - from.tx, b.ty - from.ty))[0];

/** The short land name (`core:fen_drainage` → `fen_drainage`). */
export const landName = (id: string) => id.split(":").pop()!;

/** The first tick at or after `tick` that is `inYear` ticks into a year. */
export const nextSeasonTick = (tick: number, inYear: number) => { const at = Math.floor(tick / YEAR) * YEAR + inYear; return at >= tick ? at : at + YEAR; };

/** A new game on the land (seed 1) run by the bot to `ticks`, then to mid-summer and on to mid-winter. */
export function grownLand(landId: string, ticks: number): { summer: GameState; winter: GameState } {
  let state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: landId, seed: 1 });
  if (state === null) throw new Error(`no new game on ${landId}`);
  const driver = createAutoplayTraceDriver();
  const runTo = (tick: number) => { while (state!.tick < tick) state = advanceTick(driver.apply(state!)); return state!; };
  const summer = runTo(nextSeasonTick(ticks, SEASON_TICK.summer));
  return { summer, winter: runTo(nextSeasonTick(summer.tick, SEASON_TICK.winter)) };
}

/** The town centre: its market, else its keep, its storehouse, its first building. */
export function townCentre(state: GameState): Tile {
  const building = ["market", "keep", "storehouse"].map(kind => state.buildings.find(entry => entry.kind === kind)).find(Boolean) ?? state.buildings[0];
  return building === undefined ? { tx: 45, ty: 41 } : { tx: building.tx, ty: building.ty };
}

/** The tile showing the land's character, nearest the town centre (null when the map has none). */
export function characterTile(state: GameState, land: string): { tile: Tile; what: string } | null {
  const centre = townCentre(state);
  const indices = state.tiles.map((_, index) => index);
  const touches = (index: number, terrain: string) => { const { tx, ty } = tileOf(state, index); return NEIGHBOURS.some(([dx, dy]) => terrainAt(state, tx + dx, ty + dy) === terrain); };
  const pick = (what: string, cells: readonly number[], minDistance = 0) => {
    const far = cells.map(index => tileOf(state, index)).filter(tile => chebyshev(tile, centre) >= minDistance);
    const tile = nearest(centre, far.length > 0 ? far : cells.map(index => tileOf(state, index)));
    return tile === undefined ? null : { tile, what };
  };
  const river = new Set(state.river?.cells ?? []);
  if (land === "open_field") return pick("river", [...river], 3);
  if (land === "coastal_port") {
    // The sea (water joined to the map's edge, not the brook's channel) where it meets the land.
    const sea = new Set(indices.filter(index => { const { tx, ty } = tileOf(state, index); return state.tiles[index]!.terrain === "water" && (tx === 0 || ty === 0 || tx === state.width - 1 || ty === state.height - 1); }));
    for (const index of sea) { const { tx, ty } = tileOf(state, index); for (const [dx, dy] of NEIGHBOURS) { const next = (ty + dy) * state.width + tx + dx; if (terrainAt(state, tx + dx, ty + dy) === "water" && !river.has(next)) sea.add(next); } }
    return pick("shore", [...sea].filter(index => touches(index, "grass")), 3);
  }
  if (land === "chalk_downs") {
    // The walls run round the arable and pasture zones (countrysideLand.ts); without one, a farm, else the open down.
    const fields = (state.zones ?? []).filter(zone => zone.kind === "arable" || zone.kind === "pasture").flatMap(zone => zone.membership);
    if (fields.length > 0) return pick("walled fields", fields, 3);
    const farm = nearest(centre, state.buildings.filter(building => ["wheat_farm", "pastoral_farm", "farmstead"].includes(building.kind)));
    return farm === undefined ? pick("downs", indices.filter(index => state.tiles[index]!.terrain === "grass"), 8) : { tile: { tx: farm.tx, ty: farm.ty }, what: `farm (${farm.kind})` };
  }
  if (land === "forest_edge") return pick("forest edge", indices.filter(index => state.tiles[index]!.terrain === "grass" && touches(index, "forest")), 3);
  if (land === "fen_drainage") {
    // A mere: still water with at least six still cells within two tiles.
    const still = (index: number) => state.tiles[index]!.terrain === "water" && !isFlowingWater(state, index);
    const mere = indices.filter(index => {
      if (!still(index)) return false;
      const { tx, ty } = tileOf(state, index); let count = 0;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (tx + dx >= 0 && ty + dy >= 0 && tx + dx < state.width && ty + dy < state.height && still((ty + dy) * state.width + tx + dx)) count += 1;
      return count >= 6;
    });
    return pick("meres", mere, 3);
  }
  return null;
}

export interface WorksRecord { readonly id: string; readonly origin: Tile; readonly cells: number; readonly progress: number; readonly stage: string }

/**
 * MA-11 works by the fen town: three non-overlapping drainage plans of at least nine cells nearest the town centre (their
 * 5 × 5 squares apart), commanded by `drain_fen` after their timber is added to the treasury; the first finished at
 * once, the second at 20 % of its work, the third at 80 % with four diggers.
 */
export function fenWorks(town: GameState): { state: GameState; works: readonly WorksRecord[]; focus: Tile } {
  const centre = townCentre(town);
  const plans = town.tiles.flatMap((tile, index) => {
    if (tile.terrain !== "water" || tile.hasRoad || isFlowingWater(town, index)) return [];
    const plan = drainagePlan({ ...town, treasuryTimber: town.treasuryTimber + 1_000 }, tile.tx, tile.ty);
    return plan.ok && plan.cells.length >= 9 ? [{ tx: tile.tx, ty: tile.ty, cells: plan.cells, timber: plan.timber }] : [];
  }).sort((a, b) => chebyshev(a, centre) - chebyshev(b, centre) || a.ty - b.ty || a.tx - b.tx);
  const chosen: (typeof plans)[number][] = [];
  for (const plan of plans) {
    if (chosen.length === 3) break;
    const taken = new Set(chosen.flatMap(other => other.cells));
    if (chosen.some(other => chebyshev(other, plan) < 5) || plan.cells.some(cell => taken.has(cell))) continue;
    // The second and third near the first, so one close view holds the three.
    if (chosen.length > 0 && chebyshev(chosen[0]!, plan) > 9) continue;
    chosen.push(plan);
  }
  if (chosen.length < 3) throw new Error(`fen works: only ${chosen.length} plans of 9+ cells near the town`);
  let state: GameState = { ...town, treasuryTimber: town.treasuryTimber + chosen.reduce((sum, plan) => sum + plan.timber, 0) };
  const dispatch = (plan: (typeof chosen)[number]) => {
    const next = gameReducer(state, { type: "drain_fen", tx: plan.tx, ty: plan.ty });
    if (next === state) throw new Error(`drain_fen refused at ${plan.tx},${plan.ty}: ${JSON.stringify(drainagePlan(state, plan.tx, plan.ty))}`);
    state = next;
    return state.drainage!.works.at(-1)!;
  };
  const [done, staked, drying] = chosen as [(typeof chosen)[number], (typeof chosen)[number], (typeof chosen)[number]];
  const finished = dispatch(done);
  state = advanceDrainage(state, new Map([[finished.id, finished.workNeeded]]));
  if (!finished.cells.every(cell => state.tiles[cell]!.terrain === "grass" && state.drainage!.drained.includes(cell))) throw new Error("fen works: the finished patch is not meadow");
  const first = dispatch(staked); const third = dispatch(drying);
  const progress = new Map([[first.id, 0.2], [third.id, 0.8]]);
  state = { ...state, drainage: { ...state.drainage!, works: state.drainage!.works.map(work => {
    const share = progress.get(work.id) ?? 0;
    return { ...work, workDone: Math.round(work.workNeeded * share), ...(work.id === third.id ? { diggers: 4 } : {}) };
  }) } };
  const record = (plan: (typeof chosen)[number], id: string, share: number, stage: string): WorksRecord => ({ id, origin: { tx: plan.tx, ty: plan.ty }, cells: plan.cells.length, progress: share, stage });
  return { state, focus: { tx: Math.round((done.tx + staked.tx + drying.tx) / 3), ty: Math.round((done.ty + staked.ty + drying.ty) / 3) },
    works: [record(done, finished.id, 1, "done (drained)"), record(staked, first.id, 0.2, "stage 1 staked"), record(drying, third.id, 0.8, "stage 3 drying")] };
}

export interface FordRecord { readonly width: number; readonly cells: readonly Tile[]; readonly from: Tile; readonly to: Tile; readonly laidBy: "bot" | "script" }

/** The river's ford groups (4-joined ford cells). */
function fordGroups(state: GameState): Tile[][] {
  const fords = new Set(state.river?.fords ?? []);
  const groups: Tile[][] = []; const seen = new Set<number>();
  for (const start of fords) {
    if (seen.has(start)) continue;
    const group: Tile[] = []; const queue = [start]; seen.add(start);
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head]!; const tile = tileOf(state, index); group.push(tile);
      for (const [dx, dy] of NEIGHBOURS) {
        const next = (tile.ty + dy) * state.width + tile.tx + dx;
        if (fords.has(next) && !seen.has(next) && tile.tx + dx >= 0 && tile.tx + dx < state.width) { seen.add(next); queue.push(next); }
      }
    }
    groups.push(group);
  }
  return groups;
}

/**
 * FD-1 ford roads on the brook land's town: the bot's own when it laid one, else, for each width (1 and 2 cells), a road
 * across the ford group nearest the town centre — bank to bank along the river's crossing axis (its bridge site).
 */
export function fordRoads(town: GameState): { state: GameState; fords: readonly FordRecord[]; focus: Tile } {
  const centre = townCentre(town);
  let state = town;
  const records: FordRecord[] = [];
  const groups = fordGroups(state).sort((a, b) => chebyshev(a[0]!, centre) - chebyshev(b[0]!, centre));
  for (const group of groups) if (group.every(tile => isFordRoad(state, tile))) {
    records.push({ width: group.length, cells: group, from: group[0]!, to: group.at(-1)!, laidBy: "bot" });
  }
  for (const width of [1, 2]) {
    if (records.some(record => record.width === width)) continue;
    for (const group of groups.filter(entry => entry.length === width)) {
      const site = (state.river?.bridgeSites ?? []).map(entry => {
        for (const sign of [1, -1]) {
          const step = entry.axis === "x" ? { tx: sign, ty: 0 } : { tx: 0, ty: sign };
          const water: Tile[] = []; let at: Tile = { tx: entry.tx + step.tx, ty: entry.ty + step.ty };
          while (terrainAt(state, at.tx, at.ty) === "water" && water.length < 6) { water.push(at); at = { tx: at.tx + step.tx, ty: at.ty + step.ty }; }
          if (terrainAt(state, at.tx, at.ty) === "grass" && water.length === group.length && water.every(tile => isFordCell(state, tile))
            && water.every(tile => group.some(cell => cell.tx === tile.tx && cell.ty === tile.ty))) return { from: { tx: entry.tx, ty: entry.ty }, to: at, water };
        }
        return null;
      }).find(entry => entry !== null);
      if (site === undefined || site === null) continue;
      const funded = { ...state, treasuryTimber: state.treasuryTimber + group.length };
      const built = gameReducer(funded, { type: "place_road_line", start: site.from, destination: site.to });
      if (built === funded || !site.water.every(tile => isFordRoad(built, tile))) continue;
      state = built;
      records.push({ width, cells: site.water, from: site.from, to: site.to, laidBy: "script" });
      break;
    }
  }
  if (records.length === 0) throw new Error("ford roads: no ford group could take a road");
  // The groups may lie far apart: the focus is the widest one's first cell (scripts/landCaptures.ts shoots each).
  return { state, fords: records, focus: [...records].sort((a, b) => b.width - a.width)[0]!.cells[0]! };
}

/** The fen works summer as a save file (the bytes perf:gate's scene loads), gzipped. */
export function worksSaveFixture(state: GameState): Buffer {
  const time = "2026-10-01T00:00:00.000Z";
  return gzipSync(encodeSave({ state, createdAt: time, savedAt: time, gameVersion: "0.1.0+landui" }).bytes);
}

async function main() {
  const args = process.argv.slice(2);
  const fixtureAt = args.indexOf("--perf-fixture");
  const fixture = fixtureAt >= 0 ? args[fixtureAt + 1] : undefined;
  const [out, ticksArg] = args.filter((_, index) => fixtureAt < 0 || (index !== fixtureAt && index !== fixtureAt + 1));
  if (out === undefined) throw new Error("usage: landStates.ts <out-dir> [ticks=30000] [--perf-fixture <file>]");
  mkdirSync(out, { recursive: true });
  const ticks = Number(ticksArg ?? 30_000);
  const manifest: Record<string, unknown> = {};
  const write = (name: string, state: GameState, land: string, extra: Record<string, unknown> = {}) => {
    writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
    const character = characterTile(state, land);
    const date = stateCalendar(state);
    manifest[name] = { land, tick: state.tick, year: date.year, season: date.season, buildings: state.buildings.length, walkers: state.walkers.length,
      centre: townCentre(state), character: character?.tile ?? null, characterWhat: character?.what ?? null, ...extra };
    console.log(JSON.stringify({ name, ...(manifest[name] as object) }));
  };
  for (const archetype of mapArchetypes()) {
    const started = Date.now();
    const land = landName(archetype.id);
    const { summer, winter } = grownLand(archetype.id, ticks);
    write(`${land}-summer`, summer, land, { seconds: Math.round((Date.now() - started) / 100) / 10 });
    write(`${land}-winter`, winter, land);
    if (land === "fen_drainage") {
      const { state, works, focus } = fenWorks(summer);
      write("fen_drainage-works-summer", state, land, { focus, works });
      write("fen_drainage-works-winter", { ...state, tick: state.tick + 2_000 }, land, { focus, works });
      if (fixture !== undefined) { mkdirSync(resolve(fixture, ".."), { recursive: true }); writeFileSync(fixture, worksSaveFixture(state)); }
    }
    if (land === "chalk_downs") {
      const { state, fords, focus } = fordRoads(summer);
      write("chalk_downs-ford-summer", state, land, { focus, fords });
      write("chalk_downs-ford-winter", { ...state, tick: state.tick + 2_000 }, land, { focus, fords });
    }
  }
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify({ ticks, seed: 1, states: manifest }, null, 1)}\n`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
