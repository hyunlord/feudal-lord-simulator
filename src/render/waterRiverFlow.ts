import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { isFordRoad } from "../world/bridges";
import { currentArrowKey, isFlowingWater, type FlowDirection as GridFlow } from "../world/river";
import { FLOW_DIRECTIONS, FLOW_SHEETS, type FlowDirection } from "./waterMotionModel";
import { KIND, type WaterMap } from "./waterMotionPlacement";

// LAND-UI water: the engine's river (MA-9, `state.river`, save v32) read for the water motion. Pure in the state.
//  - River flow: the channel's cells (`river.cells`) that are still water, each with the Wave 29 arrow sheet of its
//    flow letter (`currentArrowKey`, the fixed SW view: e → se, s → sw, w → nw, n → ne). Without a river (saves v31 and
//    older) the water motion keeps its shape guess (waterMotionPlacement.ts).
//  - Ford roads (FD-1, LU-D3): a road on a ford cell is the wading place the ford art covers (Wave 34 README: water →
//    the ford's shallows and gravel → the flow, kept off the stones and banks), so the flow skips it and its banks.
//  - Mill race (물레 도랑): the fulling mill is the game's only water wheel (MA-10). The flowing water in its surrounding
//    ring (the ring placement.ts checks) runs as a race instead of the plain current, in the cell's flow direction;
//    land in the ring whose water corner is river water takes it too, so no plain arrows cut into the race. The dye
//    works takes still water and gets none.
const ARROW_FLOW = Object.fromEntries(FLOW_DIRECTIONS.map(direction => [FLOW_SHEETS[direction], direction])) as Record<string, FlowDirection>;

/** The Wave 29 sheet direction of an engine flow letter (n, e, s, w), or null for an unknown letter. */
export function screenFlow(letter: string): FlowDirection | null {
  if (letter !== "n" && letter !== "e" && letter !== "s" && letter !== "w") return null;
  return ARROW_FLOW[currentArrowKey(letter as GridFlow).replace(/^water\//, "")] ?? null;
}

/** The river's water cells and their sheet directions (tile index → direction), or null without a river. */
export function riverFlowCells(state: Pick<GameState, "tiles" | "river">): ReadonlyMap<number, FlowDirection> | null {
  const river = state.river;
  if (river === undefined) return null;
  const flow = new Map<number, FlowDirection>();
  river.cells.forEach((index, at) => {
    const direction = screenFlow(river.flow[at] ?? "");
    if (direction !== null && state.tiles[index]?.terrain === "water") flow.set(index, direction);
  });
  return flow;
}

/** The ford cells that carry a road (FD-1), ascending. */
export function fordRoadCells(state: Pick<GameState, "tiles" | "width" | "height" | "river">): readonly number[] {
  const grid = { tiles: state.tiles, width: state.width, height: state.height, river: state.river };
  return (state.river?.fords ?? []).filter(index => isFordRoad(grid, { tx: index % state.width, ty: Math.floor(index / state.width) }));
}

/** Across the mill's side the race runs along it: beside its west or east side along y (sw), else along x (se). */
function alongSide(tx: number, left: number, right: number): FlowDirection {
  return tx < left || tx > right ? "sw" : "se";
}

/**
 * The mill race cells of every fulling mill (tile index → direction): its ring's flowing water (isFlowingWater: the
 * river's channel, or any water in a save without a river) that is no ford road, in the analysed flow, else (still
 * water in an old save) along the mill's side; and its ring's land that the analysis gives the river's flow.
 */
export function millRaceCells(state: Pick<GameState, "tiles" | "width" | "height" | "river" | "buildings">, map: WaterMap, fordRoads: ReadonlySet<number>): ReadonlyMap<number, FlowDirection> {
  const race = new Map<number, FlowDirection>();
  for (const building of state.buildings ?? []) {
    if (building.kind !== "fulling_mill") continue;
    const { width, height } = BUILDING_CONFIG_BY_KIND.fulling_mill;
    const right = building.tx + width - 1; const bottom = building.ty + height - 1;
    for (let ty = building.ty - 1; ty <= bottom + 1; ty += 1) for (let tx = building.tx - 1; tx <= right + 1; tx += 1) {
      if (tx >= building.tx && tx <= right && ty >= building.ty && ty <= bottom) continue;
      if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) continue;
      const index = ty * state.width + tx; const flow = map.flow[index] ?? null;
      if (fordRoads.has(index)) continue;
      if (isFlowingWater(state, index)) race.set(index, flow ?? alongSide(tx, building.tx, right));
      else if (state.tiles[index]?.terrain !== "water" && map.kind[index] === KIND.river && flow !== null) race.set(index, flow);
    }
  }
  return race;
}

/** The race cells as a key (index and direction, ascending): equal keys, the same race. */
export function raceKey(race: ReadonlyMap<number, FlowDirection>): string {
  return [...race].sort((a, b) => a[0] - b[0]).map(([index, direction]) => `${index}${direction}`).join(",");
}
