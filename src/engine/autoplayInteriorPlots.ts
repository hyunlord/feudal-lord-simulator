import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { housingLotCount } from '../population/housing';
import { canPlaceBuilding } from '../world/placement';
import type { TileCoordinate } from '../world/grid';
import { canPlaceRoad, roadLine } from '../world/roadGraph';
import { insideWall } from './autoplayBotRecovery';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { projectServiceAction } from './autoplayServiceSpaceRoutes';
import type { AutoplayAction } from './autoplay.types';
import type { GameState } from './engine.types';

/**
 * BOT-1 AR-7 interior house plots (decision BT8). Behind a wall every new lot must stand inside it (the L4 protection,
 * `preservesAutoplayWallSpace`), and the interior is small (seed 3: 156 cells for 24 lots). Guardrail run 2 stopped
 * seed 3 at 22 lots:
 * - From 103,000 ticks the town wanted a house and a site passed every placement check, but the house search walked
 *   the whole map in row order and spent its phase budget on service-space proofs of earlier interior cells; it never
 *   reached the site. For 26,000 ticks no house was placed.
 * - Meanwhile a mill with its roads and a church inside the wall took the cells the last lots needed.
 * So the housing rule searches these sites first, and a placement that leaves fewer of them than lots still to build,
 * and fewer than before, is not made: the advisor refuses such a road or production/storage building, and the service
 * planner passes over such a church or market site for its next one.
 */

const SIDES = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }] as const;
const key = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;

/** Interior cells a road may still take, and those of them joined to an interior road through such cells. */
function interiorRoadReach(state: GameState): { readonly roads: ReadonlySet<string>; readonly reach: ReadonlySet<string> } {
  const planned = new Set(state.constructionSites.flatMap(site => {
    if (!isBuildingConstructionSite(site)) return [];
    const { width, height } = BUILDING_CONFIG_BY_KIND[site.kind];
    return Array.from({ length: width * height }, (_, index) => key({ tx: site.tx + index % width, ty: site.ty + Math.floor(index / width) }));
  }));
  const interior = state.tiles.filter(tile => insideWall(state, 'house', tile));
  const roads = new Set(interior.filter(tile => tile.hasRoad).map(key));
  const open = new Set(interior.filter(tile => canPlaceRoad(state, tile) && !planned.has(key(tile))).map(key));
  const queue = interior.filter(tile => tile.hasRoad).map(tile => ({ tx: tile.tx, ty: tile.ty }));
  const reach = new Set<string>();
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    for (const { dx, dy } of SIDES) {
      const next = { tx: current.tx + dx, ty: current.ty + dy };
      if (!open.has(key(next)) || reach.has(key(next))) continue;
      reach.add(key(next));
      queue.push(next);
    }
  }
  return { roads, reach };
}

/**
 * Interior house sites: free cells inside the wall where a house may stand now (placement rule, materials aside;
 * forest is cleared) that a road reaches or can reach: road frontage now, or a neighbour joined to an interior road
 * through cells a road may still take. Cells shut in by buildings are not sites (seed 3 kept ten such cells).
 */
export function interiorHouseSites(state: GameState): readonly TileCoordinate[] {
  if (state.palisade === null) return [];
  const { roads, reach } = interiorRoadReach(state);
  return state.tiles.flatMap(tile => {
    if (tile.hasRoad || !insideWall(state, 'house', tile) || !hasAutoplayBuildingClearance(state, 'house', tile)) return [];
    if (!SIDES.some(({ dx, dy }) => { const next = key({ tx: tile.tx + dx, ty: tile.ty + dy }); return roads.has(next) || reach.has(next); })) return [];
    const placement = canPlaceBuilding(state, 'house', tile.tx, tile.ty);
    return placement.ok || placement.reason === 'insufficient_materials' ? [{ tx: tile.tx, ty: tile.ty }] : [];
  });
}

/** Lots the policy still wants: the target less the lots standing and the house sites under construction. */
export function housingLotsStillNeeded(state: GameState, targetLots: number): number {
  const planned = state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === 'house').length;
  return Math.max(0, targetLots - housingLotCount(state) - planned);
}

/** The L4 services a walled home needs within reach: the phase loop lets them in (the service planner checks its own). */
const HOME_SERVICE_KINDS: ReadonlySet<BuildingKind> = new Set(['well', 'market', 'church', 'granary']);

/**
 * False when the action would leave the walled town short of house sites for the lots it still needs. The advisor's
 * phase loop checks roads and production or storage buildings (`services: 'pass'`); the service planner checks its
 * own church and market sites while it ranks them (`'check'`), so it takes one that keeps the sites when there is one.
 */
export function keepsInteriorHouseSites(state: GameState, action: AutoplayAction, targetLots: number, services: 'pass' | 'check' = 'pass'): boolean {
  if (state.palisade === null || action.kind === 'place_building' && action.building === 'house') return true;
  if (action.kind !== 'place_road' && (action.kind !== 'place_building' || services === 'pass' && HOME_SERVICE_KINDS.has(action.building))) return true;
  const needed = housingLotsStillNeeded(state, targetLots);
  if (needed === 0 || !actionCells(action).some(cell => insideWall(state, 'house', cell))) return true;
  const after = interiorHouseSites(projectServiceAction(state, action)).length;
  return after >= needed || after >= interiorHouseSites(state).length;
}

/** Cells the action builds on: a placement outside the wall leaves the interior as it is. */
function actionCells(action: AutoplayAction): readonly TileCoordinate[] {
  if (action.kind === 'place_road') return roadLine(action.from, action.to);
  if (action.kind !== 'place_building') return [];
  const { width, height } = BUILDING_CONFIG_BY_KIND[action.building];
  return Array.from({ length: width * height }, (_, index) => ({ tx: action.tx + index % width, ty: action.ty + Math.floor(index / width) }));
}

