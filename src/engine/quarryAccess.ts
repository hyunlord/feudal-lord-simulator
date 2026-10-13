import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { canTraverseRoadBoundary } from '../world/bridges';
import { getTile, type TileCoordinate } from '../world/grid';
import { canPlaceBuildingBeforeRoad } from '../world/placement';
import { canPlaceRoad, existingRoadComponent } from '../world/roadGraph';
import { autoplayConstructionSources } from './autoplayConstructionSources';
import type { GameState } from './engine.types';
import { buildingRoadAccessTiles } from './routing';

/**
 * Quarry access ① (the user's rulings 2026-10-11/12, lord mode): the town must not wall its own quarry off. While no
 * quarry stands or is placed, a building is refused where it would leave no quarry site a road could still reach from
 * the town's roads — a dead end, not a missing lever (seed 465's opening village blocked the only rock).
 *  - A quarry site: a tile the quarry may take before its road (`canPlaceBuildingBeforeRoad`: beside rock, on free land).
 *  - Reachable: a road could be laid to a tile beside it from the construction sources' road network — over the roads and
 *    the tiles a road may take (no building, no planned building's footprint, no water), across walls only at their
 *    gates (`canTraverseRoadBoundary`), as the construction road search lays them (`searchRoad`).
 *  - The check: one path to the nearest quarry site is kept for the state; a building whose footprint misses that path
 *    and that site leaves it open, and only one that touches it searches again with its footprint closed.
 * Cache: the state object (`WeakMap`) — the sites and the path read only that state's tiles, buildings and sites.
 */
interface QuarryReach {
  /** Quarry sites (origins) with the tiles beside them a road would end on. */
  readonly sites: readonly { readonly origin: TileCoordinate; readonly access: readonly string[] }[];
  /** One road path from the network to the nearest quarry site, and that site; null when none is reachable. */
  readonly path: ReadonlySet<string> | null;
  readonly site: TileCoordinate | null;
}

const key = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;
const QUARRY = BUILDING_CONFIG_BY_KIND.quarry;
const reaches = new WeakMap<GameState, QuarryReach>();

function footprint(kind: BuildingKind, origin: TileCoordinate): readonly string[] {
  const size = BUILDING_CONFIG_BY_KIND[kind];
  const tiles: string[] = [];
  for (let dy = 0; dy < size.height; dy += 1) for (let dx = 0; dx < size.width; dx += 1) tiles.push(key({ tx: origin.tx + dx, ty: origin.ty + dy }));
  return tiles;
}

function quarrySites(state: GameState): QuarryReach["sites"] {
  const rock = state.tiles.filter(tile => tile.terrain === 'rock');
  if (rock.length === 0) return [];
  const near = new Set<string>();
  for (const tile of rock) for (let dy = -QUARRY.height; dy <= 1; dy += 1) for (let dx = -QUARRY.width; dx <= 1; dx += 1) near.add(key({ tx: tile.tx + dx, ty: tile.ty + dy }));
  const sites: { origin: TileCoordinate; access: string[] }[] = [];
  for (const entry of near) {
    const [tx, ty] = entry.split(',').map(Number) as [number, number];
    if (!canPlaceBuildingBeforeRoad(state, 'quarry', tx, ty).ok) continue;
    const inside = new Set(footprint('quarry', { tx, ty }));
    const access = new Set<string>();
    for (const tile of inside) {
      const [x, y] = tile.split(',').map(Number) as [number, number];
      for (const next of [{ tx: x, ty: y - 1 }, { tx: x - 1, ty: y }, { tx: x + 1, ty: y }, { tx: x, ty: y + 1 }]) {
        if (!inside.has(key(next)) && getTile(state, next) !== null) access.add(key(next));
      }
    }
    sites.push({ origin: { tx, ty }, access: [...access] });
  }
  return sites;
}

/** A road search from the construction network to any of the sites' access tiles, with `closed` taken; the path or null. */
function searchQuarryRoad(state: GameState, sites: QuarryReach["sites"], closed: ReadonlySet<string>): { readonly path: ReadonlySet<string>; readonly site: TileCoordinate } | null {
  const targets = new Map<string, TileCoordinate>();
  for (const site of sites) {
    if (footprint('quarry', site.origin).some(tile => closed.has(tile))) continue;
    for (const tile of site.access) if (!closed.has(tile) && !targets.has(tile)) targets.set(tile, site.origin);
  }
  if (targets.size === 0) return null;
  const planned = new Set(state.constructionSites.filter(isBuildingConstructionSite).flatMap(site => footprint(site.kind, site)));
  const free = (tile: TileCoordinate) => !closed.has(key(tile)) && (getTile(state, tile)?.hasRoad === true || (canPlaceRoad(state, tile) && !planned.has(key(tile))));
  const sources = autoplayConstructionSources(state).flatMap(building => buildingRoadAccessTiles(state, building));
  const queue = existingRoadComponent(state, sources).filter(tile => !closed.has(key(tile)));
  const parents = new Map<string, string | null>(queue.map(tile => [key(tile), null]));
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    const site = targets.get(key(current));
    if (site !== undefined) {
      const path = new Set<string>();
      for (let point: string | null = key(current); point !== null; point = parents.get(point) ?? null) path.add(point);
      return { path, site };
    }
    for (const next of [{ tx: current.tx, ty: current.ty - 1 }, { tx: current.tx - 1, ty: current.ty }, { tx: current.tx + 1, ty: current.ty }, { tx: current.tx, ty: current.ty + 1 }]) {
      if (parents.has(key(next)) || !free(next) || !canTraverseRoadBoundary(state, current, next)) continue;
      parents.set(key(next), key(current));
      queue.push(next);
    }
  }
  return null;
}

/** The quarry sites and the kept path for a state (read by the tests and the check). */
export function quarryReach(state: GameState): QuarryReach {
  const cached = reaches.get(state);
  if (cached !== undefined) return cached;
  const sites = quarrySites(state);
  const found = searchQuarryRoad(state, sites, new Set());
  const reach = { sites, path: found?.path ?? null, site: found?.site ?? null };
  reaches.set(state, reach);
  return reach;
}

/** Quarry access ①: whether a `kind` at `origin` would cut the town off from every quarry site (lord mode, no quarry yet). */
export function cutsQuarryAccess(state: GameState, kind: BuildingKind, origin: TileCoordinate): boolean {
  if (state.agency === undefined || kind === 'quarry') return false;
  if (state.buildings.some(building => building.kind === 'quarry')
    || state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === 'quarry')) return false;
  const reach = quarryReach(state);
  if (reach.path === null || reach.site === null) return false;
  const closed = new Set(footprint(kind, origin));
  const onSite = footprint('quarry', reach.site).some(tile => closed.has(tile));
  if (!onSite && ![...closed].some(tile => reach.path!.has(tile))) return false;
  return searchQuarryRoad(state, reach.sites, closed) === null;
}
