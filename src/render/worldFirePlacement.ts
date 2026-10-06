import type { Tile } from '../world/world.types';
import type { Building } from '../content/buildingConfig';
import type { GameState } from '../engine/engine.types';
import { constructionSiteFootprint } from '../economy/constructionSiteAccessors';
import { buildingFootprint } from '../geometry/buildingFootprint';
import type { TileCoordinate } from '../geometry/tileGeometry';
import { canTraverseWallBoundary } from '../world/wallTraversal';
import type { EventSceneEntry } from './art/artContract';
import { backyardPlan } from './backyardDecals';
import { screenToTile, tileToScreen } from './iso';
import { tradeWorldGroundProps } from './tradeWorldGround';
import { villageLifeCells } from './villageLife';

const key = (point: TileCoordinate): string => `${point.tx},${point.ty}`;
/** Reserve the entire painted lower band, including feet on either side of the authored pivot. */
export function worldFireSupport(entry: EventSceneEntry, point: TileCoordinate): readonly TileCoordinate[] {
  const at = tileToScreen(point.tx, point.ty), { pivot, scale } = entry.geometry;
  const cells = new Map<string, TileCoordinate>();
  const left = at.sx - pivot.x * scale, right = left + entry.image.width * scale;
  const bottom = at.sy + (entry.image.height - pivot.y) * scale;
  // Rear feet extend above pivot 200 (roughly source y173); -12px conservatively covers that 9.5px offset.
  for (let y = at.sy - 12; y <= bottom + 2; y += 2) for (let x = left - 2; x <= right + 2; x += 2) {
    const tile = screenToTile(x, y), cell = { tx: Math.floor(tile.tx), ty: Math.floor(tile.ty) };
    cells.set(key(cell), cell);
  }
  return [...cells.values()];
}
export function worldFireReserved(state: GameState): Set<string> {
  const reserved = new Set<string>();
  for (const building of state.buildings) {
    const size = buildingFootprint(building);
    for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) reserved.add(key({ tx: building.tx + x, ty: building.ty + y }));
  }
  for (const site of state.constructionSites) {
    const size = constructionSiteFootprint(site);
    for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) reserved.add(key({ tx: size.tx + x, ty: size.ty + y }));
  }
  for (const zone of state.zones ?? []) if (zone.kind !== 'burgage') {
    for (const index of zone.membership) reserved.add(key({ tx: index % state.width, ty: Math.floor(index / state.width) }));
  }
  for (const index of villageLifeCells(state)) reserved.add(key({ tx: index % state.width, ty: Math.floor(index / state.width) }));
  for (const prop of tradeWorldGroundProps(state)) for (const cell of prop.cells) reserved.add(key(cell));
  for (const prop of backyardPlan(state)) for (const cell of prop.cells) reserved.add(key(cell));
  return reserved;
}
export function worldFireBrigadeAnchor(state: GameState, building: Building, entry: EventSceneEntry, reserved: Set<string>, tileLookup?: ReadonlyMap<string, Tile>): TileCoordinate | null {
  const distance = (point: TileCoordinate): number => Math.abs(point.tx - building.tx) + Math.abs(point.ty - building.ty);
  const well = state.buildings.filter(candidate => candidate.kind === 'well').sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id))[0];
  if (well === undefined) return null;
  const dx = well.tx - building.tx, dy = well.ty - building.ty;
  const candidates: TileCoordinate[] = [];
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    if (Math.abs(x) + Math.abs(y) < 2 || Math.abs(x) + Math.abs(y) > 5 || x * dx + y * dy <= 0) continue;
    candidates.push({ tx: building.tx + x + 0.5, ty: building.ty + y + 0.5 });
  }
  candidates.sort((a, b) => distance(a) - distance(b) || Math.abs(a.tx - well.tx) + Math.abs(a.ty - well.ty) - Math.abs(b.tx - well.tx) - Math.abs(b.ty - well.ty) || a.ty - b.ty || a.tx - b.tx);
  const tiles = tileLookup ?? new Map(state.tiles.map(tile => [key(tile), tile]));
  for (const point of candidates) {
    const cells = worldFireSupport(entry, point);
    if (cells.some(cell => {
      const tile = tiles.get(key(cell));
      return tile === undefined || tile.terrain !== 'grass' || tile.buildingId !== null || reserved.has(key(cell))
        || !canTraverseWallBoundary(state, building, cell);
    })) continue;
    for (const cell of cells) reserved.add(key(cell));
    return point;
  }
  return null;
}
