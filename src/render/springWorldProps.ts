import type { GameState } from '../engine/engine.types';
import type { TileCoordinate } from '../geometry/tileGeometry';
import { constructionSiteFootprint } from '../economy/constructionSiteAccessors';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { canTraverseWallBoundary } from '../world/wallTraversal';
import type { SpringWorldEntry, SpringWorldRole } from './art/artContract';
import { SPRING_WORLD_ART } from './art/springWorldArt';
import { ART_REGISTRY } from './art/wave42Registry';
import { backyardLayout, backyardPlan, yardBackSides, yardHash } from './backyardDecals';
import { yardDecalRect } from './drawBackyardDecals';
import { villageLifeCells } from './villageLife';
import { tradeWorldGroundProps } from './tradeWorldGround';
import { boxesOverlap, tradePropBox } from './tradeWorldPlacement';
import { groundBoundaryScene } from './groundBoundaryScene';
import { calendarProgress } from './calendarProgress';
import { engineWeather } from './weatherLayers';
import { depthKey, screenToTile, tileToScreen } from './iso';
import { sortRenderItems } from './objectRenderSort';
import type { RenderQueueItem } from './objectRenderTypes';
import { tileIsVisibleInRange, type TileRange } from './renderVisibility';
import { ZONE_ASSETS, ZONE_VARIANTS } from './zoneAssetManifest';
import { boundaryV2Enabled } from './renderBoundaryFlag';

export type SpringContextRole = Extract<SpringWorldRole, 'cherry' | 'laundry' | 'nest' | 'swollen-bank'>;
export type SpringPropSelector = (role: SpringContextRole, seed: number) => SpringWorldEntry | null;
export type SpringWorldProp = {
  readonly id: string; readonly assetId: string; readonly role: SpringContextRole;
  readonly tx: number; readonly ty: number; readonly cells: readonly TileCoordinate[];
};
type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
function sourceBox(entry: SpringWorldEntry, cell: TileCoordinate): Box {
  const foot = tileToScreen(cell.tx, cell.ty), { pivot, scale } = entry.geometry;
  return { x: foot.sx - pivot.x * scale, y: foot.sy - pivot.y * scale, width: entry.image.width * scale, height: entry.image.height * scale };
}
// Immutable catalog entry identity includes source canvas, pivot, scale and role. Candidates are integer tile anchors.
// Offset memoization replaces the 2px support raster at every candidate with one raster per immutable entry.
const supportOffsets = new WeakMap<SpringWorldEntry, readonly TileCoordinate[]>();
/** Bank is a whole ground painting; reserve its whole canvas. Upright props reserve their lower ground-contact band. */
export function springPropSupport(entry: SpringWorldEntry, cell: TileCoordinate): readonly TileCoordinate[] {
  const cached = supportOffsets.get(entry);
  if (cached !== undefined) return cached.map(offset => ({ tx: cell.tx + offset.tx, ty: cell.ty + offset.ty }));
  const box = sourceBox(entry, { tx: 0, ty: 0 }), foot = tileToScreen(0, 0);
  const top = entry.role === 'swollen-bank' ? box.y : foot.sy - 3;
  const cells = new Map<string, TileCoordinate>();
  for (let y = top; y <= box.y + box.height + 1; y += 2) for (let x = box.x; x <= box.x + box.width + 1; x += 2) {
    const point = screenToTile(x, y), tx = Math.round(point.tx), ty = Math.round(point.ty);
    cells.set(`${tx},${ty}`, { tx, ty });
  }
  const offsets = [...cells.values()]; supportOffsets.set(entry, offsets);
  return offsets.map(offset => ({ tx: cell.tx + offset.tx, ty: cell.ty + offset.ty }));
}

// Complete immutable GameState identity covers every simulation input, including tick-dependent backyard circumstances.
// Selected immutable entries cover geometry and readiness; an unready-to-ready loader transition changes this key.
// Trade reservations use ART_REGISTRY metadata selection, and backyard boxes use WAVE27 metadata: both
// reserve their eventual geometry before decode. Their image readiness cannot add a previously absent obstacle.
// No GameState field is omitted: new tick/house/zone/layout state identities recompute, even when references are shared.
// Mac diagnostic (4096-tile spring save, 5 recomputes/50 reuse calls): 1.191ms -> 0.00186ms per call;
// tile scans 4096 -> 0. Not a timing gate. Advancing state intentionally recomputes.
const plans = new WeakMap<GameState, { readonly entries: readonly SpringWorldEntry[]; readonly props: readonly SpringWorldProp[] }>();
/** Display only; no state mutation and no tick/season omissions in the cache key. */
export function springWorldProps(state: GameState, select: SpringPropSelector = SPRING_WORLD_ART.select): readonly SpringWorldProp[] {
  if (calendarProgress(state).season !== 0) return [];
  const metas = new Map<SpringContextRole, SpringWorldEntry>();
  for (const role of ['cherry', 'laundry', 'nest', 'swollen-bank'] as const) {
    const meta = select(role, state.seed); if (meta !== null) metas.set(role, meta);
  }
  if (metas.size === 0) return [];
  const entries = [...metas.values()], cached = plans.get(state);
  if (cached !== undefined && entries.length === cached.entries.length && entries.every((entry, index) => entry === cached.entries[index])) return cached.props;
  const props = buildSpringWorldProps(state, metas); plans.set(state, { entries, props }); return props;
}
function buildSpringWorldProps(state: GameState, metas: ReadonlyMap<SpringContextRole, SpringWorldEntry>): readonly SpringWorldProp[] {
  const at = (cell: TileCoordinate) => cell.ty * state.width + cell.tx;
  const tileAt = (cell: TileCoordinate) => cell.tx < 0 || cell.ty < 0 || cell.tx >= state.width || cell.ty >= state.height ? undefined : state.tiles[at(cell)];
  const reserved = new Set<number>(villageLifeCells(state));
  for (const building of state.buildings) {
    const size = buildingFootprint(building);
    for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) reserved.add((building.ty + y) * state.width + building.tx + x);
  }
  for (const site of state.constructionSites) {
    const size = constructionSiteFootprint(site);
    for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) reserved.add((size.ty + y) * state.width + size.tx + x);
  }
  const yards = backyardLayout(state), decals = backyardPlan(state), trades = tradeWorldGroundProps(state);
  const boxes: Box[] = decals.map(yardDecalRect);
  for (const yard of decals) for (const cell of yard.cells) reserved.add(at(cell));
  for (const prop of trades) {
    for (const cell of prop.cells) reserved.add(at(cell));
    const entry = ART_REGISTRY.entry(prop.assetId);
    if (entry?.kind === 'ground-prop' && 'occupations' in entry) boxes.push(tradePropBox(entry, prop.cell));
  }
  const scene = groundBoundaryScene(state);
  for (const prop of scene.zones.props) reserved.add(at({ tx: Math.round(prop.x), ty: Math.round(prop.y) }));
  for (const bed of scene.yardProps.beds) {
    const key = ZONE_VARIANTS.croftBed[bed.variant], meta = ZONE_ASSETS.find(asset => asset.key === key);
    if (meta === undefined || !('displayWidth' in meta)) continue;
    const width = meta.displayWidth, height = width * meta.height / meta.width, foot = tileToScreen(bed.anchor.x, bed.anchor.y);
    const left = width * meta.anchorX / meta.width;
    boxes.push({ x: foot.sx - (bed.mirror ? width - left : left), y: foot.sy - height * meta.anchorY / meta.height, width, height });
  }
  for (const hurdle of scene.yardProps.hurdles) reserved.add(at({ tx: Math.round(hurdle.anchor.x), ty: Math.round(hurdle.anchor.y) }));
  const result: SpringWorldProp[] = [];
  const put = (role: SpringContextRole, id: string, cell: TileCoordinate, own?: ReadonlySet<number>): boolean => {
    const entry = metas.get(role); if (entry === undefined) return false;
    const cells = springPropSupport(entry, cell), box = sourceBox(entry, cell);
    if (cells.length === 0 || cells.some(point => {
      const tile = tileAt(point);
      return tile === undefined || tile.hasRoad || tile.buildingId !== null || reserved.has(at(point))
        || (tile.terrain !== 'grass' && !(role === 'swollen-bank' && tile.terrain === 'water'))
        || (own !== undefined && !own.has(at(point))) || !canTraverseWallBoundary(state, cell, point);
    }) || boxes.some(other => boxesOverlap(box, other))) return false;
    result.push({ id, assetId: entry.id, role, tx: cell.tx, ty: cell.ty, cells });
    boxes.push(box); for (const point of cells) reserved.add(at(point)); return true;
  };
  // An ornamental cherry in an actual orchard's unoccupied gap. Fruit-bearing species are never substituted.
  for (const zone of state.zones ?? []) {
    if (zone.kind !== 'orchard' || !metas.has('cherry')) continue;
    const own = new Set(zone.membership);
    const candidates = [...zone.membership].sort((a, b) => yardHash(`${zone.id}:${a}`, state.seed) - yardHash(`${zone.id}:${b}`, state.seed) || a - b);
    for (const index of candidates) if (put('cherry', `spring:ornamental-cherry:${zone.id}`, { tx: index % state.width, ty: Math.floor(index / state.width) }, own)) break;
  }
  for (const yard of yards) {
    const house = state.houses.find(house => house.buildingId === yard.buildingId);
    const building = state.buildings.find(building => building.id === yard.buildingId);
    if (house === undefined || building === undefined || house.residents <= 0 || house.burntTick !== undefined || house.abandonedTick !== undefined) continue;
    const side = yardBackSides(state, building)[0]; if (side === undefined) continue;
    const own = new Set([...yard.cells, ...yard.spill].map(at));
    for (const cell of yard.spill) {
      if ((cell.tx - building.tx) * side.tx + (cell.ty - building.ty) * side.ty <= 0 || !canTraverseWallBoundary(state, building, cell)) continue;
      if (put('laundry', `spring:laundry:${yard.buildingId}`, cell, own)) break;
    }
  }
  const wet = engineWeather(state).weather === 'wet';
  for (const tile of state.tiles) {
    if (tile.terrain !== 'grass' || tile.hasRoad || tile.buildingId !== null) continue;
    const near = [{ tx: tile.tx - 1, ty: tile.ty }, { tx: tile.tx + 1, ty: tile.ty }, { tx: tile.tx, ty: tile.ty - 1 }, { tx: tile.tx, ty: tile.ty + 1 }];
    const hash = yardHash(`${tile.tx},${tile.ty}`, state.seed);
    if (hash % 7 === 0 && near.some(point => tileAt(point)?.terrain === 'forest')) put('nest', `spring:nest:${tile.tx},${tile.ty}`, tile);
    if (wet && hash % 5 === 0 && near.some(point => tileAt(point)?.terrain === 'water')) put('swollen-bank', `spring:bank:${tile.tx},${tile.ty}`, tile);
  }
  return result;
}
export function withSpringWorldProps(queue: readonly RenderQueueItem[], state: GameState, range: TileRange): readonly RenderQueueItem[] {
  if (!boundaryV2Enabled()) return queue;
  const props = springWorldProps(state).filter(prop => tileIsVisibleInRange(prop.tx, prop.ty, range));
  return props.length === 0 ? queue : sortRenderItems([...queue, ...props.map(prop => ({ kind: 'spring_prop' as const, id: prop.id, prop, depth: depthKey(prop.tx, prop.ty), anchorTx: prop.tx }))]);
}
export function drawSpringWorldProp(context: CanvasRenderingContext2D, prop: SpringWorldProp, zoom: number): boolean {
  const point = tileToScreen(prop.tx, prop.ty);
  return SPRING_WORLD_ART.draw(context, prop.assetId, point.sx, point.sy, zoom);
}
