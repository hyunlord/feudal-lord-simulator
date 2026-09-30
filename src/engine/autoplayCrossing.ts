/**
 * FIX-10 (FD-4, spec docs/design/map-archetypes.md): the bot crosses the river for a resource. When its quarry or
 * logging camp finds no site, and the land across the water has the rock or wood it needs, it builds its road to the near
 * bank of the cheapest crossing — a ford where the river has one, else a bridge at a bridge site — and then the crossing
 * to the far bank; its usual road building reaches the far side's sites from there. One crossing per town.
 */
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";
import { roadPlacementFailure } from "./roadPlacement";
import type { GameState } from "./engine.types";
import type { AutoplayAction } from "./autoplay.types";
import { isFordCell } from "../world/bridges";
import { roadLine } from "../world/roadGraph";
import { roadActionToTargets } from "./autoplayConstructionRoads";
import type { TileCoordinate } from "../world/grid";

const NONE: AutoplayAction = { kind: "none" };

/** Land (not water) reached from `starts` in four directions: a side of the river. */
function landSide(state: GameState, starts: readonly number[]): Uint8Array {
  const seen = new Uint8Array(state.width * state.height);
  const queue = starts.filter(index => state.tiles[index]?.terrain !== "water");
  for (const index of queue) seen[index] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head]!;
    const tx = at % state.width, ty = (at - tx) / state.width;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue;
      const next = y * state.width + x;
      if (seen[next] === 1 || state.tiles[next]?.terrain === "water") continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  return seen;
}

export function crossingAction(state: GameState, kind: BuildingKind): AutoplayAction {
  const terrain = BUILDING_CONFIG_BY_KIND[kind].requiresAdjacentTerrain;
  const river = state.river;
  if (river === undefined || (kind !== "quarry" && kind !== "logging_camp") || terrain === null) return NONE;
  if (state.tiles.some(tile => tile.terrain === "water" && tile.hasRoad)) return NONE;
  const roads = state.tiles.flatMap((tile, index) => tile.hasRoad ? [index] : []);
  if (roads.length === 0) return NONE;
  const townSide = landSide(state, roads);
  let best: { readonly action: AutoplayAction; readonly cost: number } | null = null;
  for (const site of river.bridgeSites) {
    const step = site.axis === "x" ? { tx: 1, ty: 0 } : { tx: 0, ty: 1 };
    for (const sign of [1, -1]) {
      // Across: from the site's bank over the water to the first land on the other side.
      const water: TileCoordinate[] = [];
      let other: TileCoordinate | null = null;
      for (let offset = 1; offset <= 6; offset += 1) {
        const at = { tx: site.tx + step.tx * sign * offset, ty: site.ty + step.ty * sign * offset };
        const tile = state.tiles[at.ty * state.width + at.tx];
        if (at.tx < 0 || at.ty < 0 || at.tx >= state.width || at.ty >= state.height || tile === undefined) break;
        if (tile.terrain === "water") { water.push(at); continue; }
        other = at;
        break;
      }
      if (water.length === 0 || other === null) continue;
      // The near bank is the one on the town's side.
      const bank = { tx: site.tx, ty: site.ty };
      const bankOnTown = townSide[bank.ty * state.width + bank.tx] === 1, otherOnTown = townSide[other.ty * state.width + other.tx] === 1;
      if (bankOnTown === otherOnTown) continue;
      const near = bankOnTown ? bank : other, far = bankOnTown ? other : bank;
      const nearIndex = near.ty * state.width + near.tx, farIndex = far.ty * state.width + far.tx;
      const farSide = landSide(state, [farIndex]);
      if (!state.tiles.some((tile, index) => farSide[index] === 1 && tile.terrain === terrain)) continue;
      if (roadPlacementFailure(state, roadLine(near, far)) !== null) continue;
      const fords = water.every(tile => isFordCell(state, tile));
      const crossingCost = water.length + 1 + (fords ? 0 : water.length * 3);
      // The near bank on the roads: the crossing itself. Otherwise the bot's road to the bank first (its planner's
      // next straight piece; later calls go on until the bank is reached, then cross).
      if (state.tiles[nearIndex]?.hasRoad === true) {
        if (best === null || crossingCost < best.cost) best = { action: { kind: "place_road", from: near, to: far }, cost: crossingCost };
        continue;
      }
      const approach = roadActionToTargets(state, [near]);
      if (approach.kind !== "place_road") continue;
      const cost = crossingCost + Math.abs(approach.from.tx - near.tx) + Math.abs(approach.from.ty - near.ty);
      if (best === null || cost < best.cost) best = { action: approach, cost };
    }
  }
  return best?.action ?? NONE;
}
