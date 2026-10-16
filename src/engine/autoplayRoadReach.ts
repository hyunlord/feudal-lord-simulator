import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { canTraverseRoadBoundary } from '../world/bridges';
import { getTile, type TileCoordinate } from '../world/grid';
import { canPlaceRoad, existingRoadComponent } from '../world/roadGraph';
import { autoplayConstructionSources } from './autoplayConstructionSources';
import type { GameState } from './engine.types';
import { buildingRoadAccessTiles } from './routing';

/**
 * DELIVERY-GAP ①a (the user's ruling 2026-10-16, both modes): how far a construction road would run to a building site —
 * the same search the bot's road is laid by (`autoplayConstructionRoads.ts` searchRoad): from the construction sources'
 * road network, over roads and the tiles a road may take (no building, no planned building's footprint, no water), across
 * walls only at their gates. The "road first" step ranks its candidates by this distance, not the straight line to any
 * road: seed 26's nearest quarry sites by the straight line lay past the rock with no road to them, while the one site a
 * road reaches, five tiles off, was never tried (DGX engine-GAP-diag2-00125eb).
 * Cache: the state object (`WeakMap`) — the search reads only that state's tiles, buildings and sites. Built once per
 * state, only when the step needs it (its fallback, after the site search found nothing).
 */
const key = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;
const distances = new WeakMap<GameState, ReadonlyMap<string, number>>();

function constructionRoadDistances(state: GameState): ReadonlyMap<string, number> {
  const cached = distances.get(state);
  if (cached !== undefined) return cached;
  const planned = new Set<string>();
  for (const site of state.constructionSites.filter(isBuildingConstructionSite)) {
    const size = BUILDING_CONFIG_BY_KIND[site.kind];
    for (let dy = 0; dy < size.height; dy += 1) for (let dx = 0; dx < size.width; dx += 1) planned.add(key({ tx: site.tx + dx, ty: site.ty + dy }));
  }
  const free = (tile: TileCoordinate) => getTile(state, tile)?.hasRoad === true || (canPlaceRoad(state, tile) && !planned.has(key(tile)));
  const start = existingRoadComponent(state, autoplayConstructionSources(state).flatMap(building => buildingRoadAccessTiles(state, building)));
  const reached = new Map<string, number>(start.map(tile => [key(tile), 0]));
  const queue = [...start];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    const next = (reached.get(key(current)) ?? 0) + 1;
    for (const tile of [{ tx: current.tx, ty: current.ty - 1 }, { tx: current.tx - 1, ty: current.ty }, { tx: current.tx + 1, ty: current.ty }, { tx: current.tx, ty: current.ty + 1 }]) {
      if (reached.has(key(tile)) || !free(tile) || !canTraverseRoadBoundary(state, current, tile)) continue;
      reached.set(key(tile), next);
      queue.push(tile);
    }
  }
  distances.set(state, reached);
  return reached;
}

/**
 * The construction road's distance to a `kind` at `origin`: the nearest of its access tiles (the footprint's sides, as
 * `buildingRoadAccessTiles` reads them once a road is there) the search reaches; Infinity when none is reached.
 */
export function constructionRoadDistance(state: GameState, kind: BuildingKind, origin: TileCoordinate): number {
  const reached = constructionRoadDistances(state);
  const { width, height } = BUILDING_CONFIG_BY_KIND[kind];
  const sides: TileCoordinate[] = [];
  for (let dx = 0; dx < width; dx += 1) sides.push({ tx: origin.tx + dx, ty: origin.ty - 1 }, { tx: origin.tx + dx, ty: origin.ty + height });
  for (let dy = 0; dy < height; dy += 1) sides.push({ tx: origin.tx - 1, ty: origin.ty + dy }, { tx: origin.tx + width, ty: origin.ty + dy });
  let best = Infinity;
  for (const side of sides) {
    const at = reached.get(key(side));
    if (at === undefined || at >= best) continue;
    // As `buildingRoadAccessTiles`: the side reached from the footprint across any wall line only at a gate.
    const inside = { tx: Math.max(origin.tx, Math.min(side.tx, origin.tx + width - 1)), ty: Math.max(origin.ty, Math.min(side.ty, origin.ty + height - 1)) };
    if (canTraverseRoadBoundary(state, inside, side)) best = at;
  }
  return best;
}
