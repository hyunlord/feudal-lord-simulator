import type { GameState } from '../engine/engine.types';
import type { TileCoordinate } from '../geometry/tileGeometry';
import type { HouseholdGroundPropEntry } from './art/artContract';
import { tileToScreen } from './iso';
import { tradesOf } from '../engine/trades';
import { zonesOf } from '../zones/zoneEdits';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/constructionSiteAccessors';

export function tradeGroundReservations(state: GameState, yards: readonly { readonly cells: readonly TileCoordinate[] }[]): Set<number> {
  const cells = new Set(yards.flatMap(yard => yard.cells.map(cell => cell.ty * state.width + cell.tx)));
  for (const zone of zonesOf(state)) if (zone.kind !== 'burgage') for (const at of zone.membership) cells.add(at);
  for (const site of state.constructionSites) {
    if (!isBuildingConstructionSite(site)) continue;
    const size = BUILDING_CONFIG_BY_KIND[site.kind];
    for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) cells.add((site.ty + y) * state.width + site.tx + x);
  }
  return cells;
}
export function tradePropCells(entry: HouseholdGroundPropEntry, cell: TileCoordinate): readonly TileCoordinate[] {
  const footprint = entry.geometry.footprint ?? { width: 1, height: 1 };
  return Array.from({ length: Math.ceil(footprint.width) * Math.ceil(footprint.height) }, (_, at) => ({
    tx: cell.tx + at % Math.ceil(footprint.width), ty: cell.ty + Math.floor(at / Math.ceil(footprint.width)),
  }));
}
export function tradePropBox(entry: HouseholdGroundPropEntry, cell: TileCoordinate) {
  const foot = tileToScreen(cell.tx, cell.ty), { pivot, scale } = entry.geometry;
  return { x: foot.sx - pivot.x * scale, y: foot.sy - pivot.y * scale, width: entry.image.width * scale, height: entry.image.height * scale };
}
export function boxesOverlap(a: ReturnType<typeof tradePropBox>, b: ReturnType<typeof tradePropBox>): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Physical source requirements. These read existing objects; they do not assert production or pollution facts. */
export function tradeSourceSpaceAllows(state: GameState, entry: HouseholdGroundPropEntry, cell: TileCoordinate): boolean {
  const near = (point: TileCoordinate, distance: number) => Math.max(Math.abs(point.tx - cell.tx), Math.abs(point.ty - cell.ty)) <= distance;
  const kinds = entry.archetypes;
  if (kinds.includes('warehouse_shop') && !state.buildings.some(building => building.kind === 'storehouse' && near(building, 3))) return false;
  if (kinds.includes('dirty_yard') || kinds.includes('nuisance_yard')) {
    if (state.buildings.some(building => ['well', 'market', 'granary'].includes(building.kind) && near(building, 3))) return false;
    const foodHouses = new Set(tradesOf(state).households.filter(house => house.tradeId === 'baker' || house.tradeId === 'innkeeper').map(house => house.houseId));
    if (state.buildings.some(building => foodHouses.has(building.id) && near(building, 3))) return false;
  }
  if (kinds.includes('nuisance_yard') && state.buildings.some(building => building.kind === 'house' && near(building, 1))) return false;
  if (kinds.includes('forge')) {
    if (state.buildings.some(building => near(building, 1))) return false;
    if (state.tiles.some(tile => tile.terrain === 'forest' && near(tile, 1))) return false;
  }
  return true;
}
