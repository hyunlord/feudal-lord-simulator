import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import type { RiverData } from "../world/river";
import type { Tile } from "../world/world.types";
import type { GroundChunkPlan } from "./groundBoundaryScene";
import { tileToScreen } from "./iso";
import { landWorksWaterCells } from "./landWorksDraw";
import { FLOW_DIRECTIONS, type FlowDirection } from "./waterMotionModel";
import { analyseWater, chunkWater, type WaterMap, type WaterSpot } from "./waterMotionPlacement";
import { fordRoadCells, millRaceCells, raceKey, riverFlowCells } from "./waterRiverFlow";

// INSTALL-29 / LAND-UI water motion paths (moved out of drawWaterMotion.ts, which draws them): the map's water analysis
// and, per ground chunk, its tile classes as Path2D diamonds and its glint / fish spots.
export type DirectionPaths = Readonly<Record<FlowDirection, Path2D | null>>;
type ChunkPaths = { readonly deep: Path2D | null; readonly shallow: Path2D | null; readonly flow: DirectionPaths; readonly race: DirectionPaths;
  readonly glints: readonly WaterSpot[]; readonly fish: readonly WaterSpot[] };
type MapEntry = { readonly tiles: readonly Tile[]; readonly seed: number; readonly river: RiverData | undefined; readonly terrain: string;
  readonly map: WaterMap; readonly fords: ReadonlySet<number>; readonly chunks: Map<string, ChunkPaths>; view: { readonly key: string; readonly paths: ChunkPaths } | null;
  buildings: readonly Building[] | null; race: ReadonlyMap<number, FlowDirection>; raceKey: string;
  /** The land works' water cells (landWorksWaterCells), where no motion draws, and their key. */
  works: ReadonlySet<number> | null; masked: ReadonlySet<number>; maskKey: string };

// Cache (AGENTS rule 10): the map's water analysis and, per 8 x 8-tile chunk, its tile classes as Path2D diamonds and its
// glint / fish spots, plus the visible chunks' paths joined; key: the terrain (every tile's terrain in order, checked when
// the tiles array changes: a building, road or bridge makes a new array but leaves the water as it was) with the ford
// cells that carry a road (LAND-UI: the flow skips them), the map size, the seed and the river (the state's RiverData
// object: the engine never rebuilds it, a load brings a new one); the chunks' paths also by the mill race cells (their
// key, raceKey, rechecked when the buildings array changes: a new fulling mill moves the race, other buildings do
// not) and by the land works' water cells (their sorted list, rechecked when landWorksWaterCells gives a new set: road
// fords and stage-3 drainage, whose baked stones, banks and mud the motion must not cover); the joined paths also by the
// visible chunk span. Reason: the analysis walks every tile and the river
// sets (with all 64 chunks' lists 0.50 ms, median of 30 after 10 warm-up runs, Node, the palisade-construction save;
// 0.70 ms on a seed-93 map with a channel; the terrain check 0.05 ms), and a chunk's diamonds are the same every
// frame; nothing else reads into them (the weather, the season and the clock pick what is drawn and which frame, not
// where). Measured (the terrain.water stage, mean of 200 frames, headless Chrome
// --disable-gpu on the Mac, the pop176 lake at zoom 1.1, two runs): 0.20 ms cached, 0.23-0.25 ms with the chunk and
// view paths rebuilt every frame; 0.04 ms with no water motion. Again with the river length rule (the palisade-
// construction lake at zoom 1.1, paused, 240 frames, two runs): 0.14 ms cached, 0.005 ms with no water motion.
let mapEntry: MapEntry | null = null;
export function waterMapFor(state: GameState): MapEntry {
  let entry = mapEntry;
  if (entry === null || entry.tiles !== state.tiles || entry.seed !== state.seed || entry.river !== state.river) {
    const fords = fordRoadCells(state);
    const terrain = `${state.width}x${state.height}:${state.tiles.map(tile => tile.terrain === "water" ? "w" : "l").join("")}|f${fords.join(",")}`;
    if (entry !== null && entry.terrain === terrain && entry.seed === state.seed && entry.river === state.river) entry = { ...entry, tiles: state.tiles };
    else {
      const fordRoads = new Set(fords);
      entry = { tiles: state.tiles, seed: state.seed, river: state.river, terrain, fords: fordRoads, chunks: new Map(), view: null, buildings: null, race: new Map(), raceKey: "", works: null, masked: new Set(), maskKey: "",
        map: analyseWater(state.tiles, state.width, state.height, { river: riverFlowCells(state), fordRoads }) };
    }
    mapEntry = entry;
  }
  if (entry.buildings !== state.buildings) {
    const race = millRaceCells(state, entry.map, entry.fords); const key = raceKey(race);
    entry.buildings = state.buildings;
    if (key !== entry.raceKey) { entry.race = race; entry.raceKey = key; entry.chunks.clear(); entry.view = null; }
  }
  const works = landWorksWaterCells(state);
  if (entry.works !== works) {
    const key = [...works].sort((a, b) => a - b).join(",");
    entry.works = works;
    if (key !== entry.maskKey) { entry.masked = works; entry.maskKey = key; entry.chunks.clear(); entry.view = null; }
  }
  return entry;
}

function diamonds(tiles: readonly Tile[]): Path2D | null {
  if (tiles.length === 0) return null;
  const path = new Path2D();
  for (const tile of tiles) {
    const { sx, sy } = tileToScreen(tile.tx, tile.ty);
    path.moveTo(sx, sy - 16); path.lineTo(sx + 32, sy); path.lineTo(sx, sy + 16); path.lineTo(sx - 32, sy); path.closePath();
  }
  return path;
}

function chunkPaths(entry: MapEntry, state: Pick<GameState, "tiles" | "seed">, plan: GroundChunkPlan): ChunkPaths {
  const key = `${plan.cx},${plan.cy}`;
  let paths = entry.chunks.get(key);
  if (paths === undefined) {
    const water = chunkWater(entry.map, state.tiles, state.seed, plan.cx, plan.cy, entry.race, entry.masked);
    paths = { deep: diamonds(water.deep), shallow: diamonds(water.shallow), glints: water.glints, fish: water.fish,
      flow: { ne: diamonds(water.flow.ne), nw: diamonds(water.flow.nw), se: diamonds(water.flow.se), sw: diamonds(water.flow.sw) },
      race: { ne: diamonds(water.race.ne), nw: diamonds(water.race.nw), se: diamonds(water.race.se), sw: diamonds(water.race.sw) } };
    entry.chunks.set(key, paths);
  }
  return paths;
}

function joined(parts: readonly (Path2D | null)[]): Path2D | null {
  const present = parts.filter((part): part is Path2D => part !== null);
  if (present.length === 0) return null;
  const path = new Path2D();
  for (const part of present) path.addPath(part);
  return path;
}

export function viewPaths(entry: MapEntry, state: Pick<GameState, "tiles" | "seed">, chunks: readonly GroundChunkPlan[]): ChunkPaths {
  const key = chunks.map(plan => `${plan.cx},${plan.cy}`).join(";");
  if (entry.view?.key === key) return entry.view.paths;
  const each = chunks.map(plan => chunkPaths(entry, state, plan));
  const byDirection = (part: "flow" | "race") => Object.fromEntries(FLOW_DIRECTIONS.map(direction => [direction, joined(each.map(paths => paths[part][direction]))])) as DirectionPaths;
  const paths = { deep: joined(each.map(paths => paths.deep)), shallow: joined(each.map(paths => paths.shallow)), flow: byDirection("flow"), race: byDirection("race"),
    glints: each.flatMap(paths => paths.glints), fish: each.flatMap(paths => paths.fish) };
  entry.view = { key, paths };
  return paths;
}
