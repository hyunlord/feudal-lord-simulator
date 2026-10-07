import { FARM_PROP_ART } from './farmPropArt';
import type { GameState } from '../engine/engine.types';
import type { ArtRect } from './art/artContract';
import { SPRING_WORLD_ART } from './art/springWorldArt';
import type { FarmProp } from './farmProps';
import { screenToTile, tileToScreen } from './iso';
import { ZONE_VARIANTS } from './zoneAssetManifest';
import { zonesOf } from '../zones/zoneEdits';

export type SpringPastureState = Pick<GameState, 'tiles' | 'zones' | 'width'>;
type SpringArt = Pick<typeof SPRING_WORLD_ART, 'select' | 'draw'>;
type Placement = { readonly id: string; readonly x: number; readonly y: number };
const flockKinds: ReadonlySet<string> = new Set(ZONE_VARIANTS.sheepFlock);
function identitySeed(id: string): number {
  let seed = 2166136261;
  for (let i = 0; i < id.length; i += 1) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619) >>> 0;
  return seed;
}
function overlaps(a: ArtRect, b: ArtRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
const supportCache = new WeakMap<object, WeakMap<object, { readonly width: number; readonly cells: ReadonlyMap<number, string> }>>();
function supportCells(state: SpringPastureState): ReadonlyMap<number, string> {
  const zones = zonesOf(state);
  let byTiles = supportCache.get(zones);
  if (!byTiles) { byTiles = new WeakMap(); supportCache.set(zones, byTiles); }
  const cached = byTiles.get(state.tiles); if (cached?.width === state.width) return cached.cells;
  const owners = new Map<number, string>();
  for (const zone of zones) if (zone.kind === 'pasture') for (const index of zone.membership) owners.set(index, zone.id);
  for (const zone of zones) if (zone.kind !== 'pasture') for (const index of zone.membership) owners.delete(index);
  const cells = new Map<number, string>();
  for (const tile of state.tiles) {
    const index = tile.ty * state.width + tile.tx; const owner = owners.get(index);
    if (owner && tile.terrain === 'grass' && tile.buildingId === null && !tile.hasRoad) cells.set(index, owner);
  }
  byTiles.set(state.tiles, { width: state.width, cells }); return cells;
}
/** All cells touched by the full canvas's inverse-projected bounding box must support the prop. */
function supports(rect: ArtRect, cells: ReadonlyMap<number, string>, width: number, owner: string): boolean {
  const corners = [screenToTile(rect.x, rect.y), screenToTile(rect.x + rect.width, rect.y), screenToTile(rect.x, rect.y + rect.height), screenToTile(rect.x + rect.width, rect.y + rect.height)];
  const minX = Math.floor(Math.min(...corners.map(point => point.tx)) + 0.5);
  const maxX = Math.floor(Math.max(...corners.map(point => point.tx)) + 0.5);
  const minY = Math.floor(Math.min(...corners.map(point => point.ty)) + 0.5);
  const maxY = Math.floor(Math.max(...corners.map(point => point.ty)) + 0.5);
  for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
    if (x < 0 || x >= width || y < 0 || cells.get(y * width + x) !== owner) return false;
  }
  return true;
}

/** A display companion for an already-present flock; never a new simulation animal or birth. */
export function springPasturePlacement(state: SpringPastureState, prop: FarmProp, props: readonly FarmProp[], season: number, zoom: number, art: SpringArt = SPRING_WORLD_ART, propBounds: (prop: FarmProp) => ArtRect | null = FARM_PROP_ART.bounds): Placement | null {
  if (season !== 0 || zoom < 0.6 || !flockKinds.has(prop.kind)) return null;
  const cells = supportCells(state); const owner = cells.get(Math.round(prop.y) * state.width + Math.round(prop.x));
  if (!owner || !prop.id.startsWith(`farm-prop:${owner}:`)) return null;
  const entry = art.select('ewe-lamb', identitySeed(prop.id)); if (!entry) return null;
  const flock = propBounds(prop); if (!flock) return null;
  const foot = tileToScreen(prop.x, prop.y); const scale = entry.geometry.scale;
  const width = entry.image.width * scale; const height = entry.image.height * scale;
  const directions = identitySeed(prop.id) % 2 === 0 ? [-1, 1] : [1, -1];
  for (const side of directions) {
    const left = side < 0 ? flock.x - width - 4 : flock.x + flock.width + 4;
    const bounds = { x: left, y: foot.sy - entry.geometry.pivot.y * scale, width, height };
    if (!supports(bounds, cells, state.width, owner)) continue;
    const blocked = props.some(other => {
      const box = propBounds(other); if (!box) return false;
      // Reserve the possible companion reach of other flocks, so independent draws cannot collide.
      const margin = other.id !== prop.id && flockKinds.has(other.kind) ? width + 4 : 0;
      return overlaps(bounds, { ...box, x: box.x - margin, width: box.width + margin * 2 });
    });
    if (!blocked) return { id: entry.id, x: left + entry.geometry.pivot.x * scale, y: foot.sy };
  }
  return null;
}
export function drawSpringPasture(context: CanvasRenderingContext2D, state: SpringPastureState, prop: FarmProp, props: readonly FarmProp[], season: number, zoom: number, art: SpringArt = SPRING_WORLD_ART): boolean {
  const placement = springPasturePlacement(state, prop, props, season, zoom, art);
  return placement !== null && art.draw(context, placement.id, placement.x, placement.y, zoom);
}
