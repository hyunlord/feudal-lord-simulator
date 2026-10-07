import type { GameState } from '../engine/engine.types';
import { pastureTending } from '../engine/cloth';
import { CLOTH_BALANCE } from '../content/clothConfig';
import { zonesOf } from '../zones/zoneEdits';
import { groundBoundaryScene, type GroundBoundaryScene } from './groundBoundaryScene';
import { calendarProgress } from './calendarProgress';
import { tileToScreen, screenToTile } from './iso';
import type { ArtRect, FacilityGroundPropEntry } from './art/artContract';
import { washPoolReservations } from './washPoolReservations';
import { boxesOverlap } from './tradeWorldPlacement';
import { yardHash } from './backyardDecals';
import { constructionSiteFootprint } from '../economy/constructionSiteAccessors';

export type WashPoolProp = { readonly id: string; readonly assetId: string; readonly farmId: string; readonly tx: number; readonly ty: number };
export function washPoolBox(entry: FacilityGroundPropEntry, tx: number, ty: number): ArtRect {
  const at = tileToScreen(tx, ty), { pivot, scale } = entry.geometry;
  return { x: at.sx - pivot.x * scale, y: at.sy - pivot.y * scale, width: entry.image.width * scale, height: entry.image.height * scale };
}
export function washPoolSupport(entry: FacilityGroundPropEntry, tx: number, ty: number) {
  const r = washPoolBox(entry, tx, ty);
  const corners = [screenToTile(r.x, r.y), screenToTile(r.x + r.width, r.y), screenToTile(r.x, r.y + r.height), screenToTile(r.x + r.width, r.y + r.height)];
  const cells: { tx: number; ty: number }[] = [];
  for (let y = Math.floor(Math.min(...corners.map(p => p.ty)) + 0.5); y <= Math.floor(Math.max(...corners.map(p => p.ty)) + 0.5); y++)
    for (let x = Math.floor(Math.min(...corners.map(p => p.tx)) + 0.5); x <= Math.floor(Math.max(...corners.map(p => p.tx)) + 0.5); x++) cells.push({ tx: x, ty: y });
  return cells;
}
const cache = new WeakMap<GameState, WeakMap<readonly FacilityGroundPropEntry[], { scene: GroundBoundaryScene; props: readonly WashPoolProp[] }>>();
/** No economy, animals or jobs are created. Missing support always means no prop. */
const singleEntries = new WeakMap<FacilityGroundPropEntry, readonly FacilityGroundPropEntry[]>();
export function washPoolProps(state: GameState, entry: FacilityGroundPropEntry | null): readonly WashPoolProp[] {
  if (!entry) return [];
  let entries = singleEntries.get(entry); if (!entries) { entries = [entry]; singleEntries.set(entry, entries); }
  return facilityGroundProps(state, entries);
}
export function facilityGroundProps(state: GameState, entries: readonly FacilityGroundPropEntry[]): readonly WashPoolProp[] {
  const eligible = entries.filter(e => e.buildingKinds.includes('pastoral_farm') && (e.pastureYard || calendarProgress(state).season !== 3))
    .sort((a, b) => Number(Boolean(a.pastureYard)) - Number(Boolean(b.pastureYard)) || (b.pastureYard?.priority ?? 0) - (a.pastureYard?.priority ?? 0) || a.id.localeCompare(b.id));
  if (!eligible.length) return [];
  const scene = groundBoundaryScene(state);
  const cached = cache.get(state)?.get(entries); if (cached?.scene === scene) return cached.props;
  const tending = pastureTending(state);
  const farms = state.buildings.filter(b => b.kind === 'pastoral_farm' && (tending.get(b.id) ?? 0) > 0).sort((a, b) => a.id.localeCompare(b.id));
  if (!farms.length) return [];
  const pasture = new Set<number>();
  for (const zone of zonesOf(state)) if (zone.kind === 'pasture') for (const at of zone.membership) pasture.add(at);
  for (const zone of zonesOf(state)) if (zone.kind !== 'pasture') for (const at of zone.membership) pasture.delete(at);
  const owners = new Map<number, string>();
  for (const at of pasture) {
    const x = at % state.width, y = Math.floor(at / state.width); let nearest: { id: string; distance: number } | null = null;
    for (const farm of farms) {
      const distance = Math.max(farm.tx - x, 0, x - farm.tx - 1, farm.ty - y, y - farm.ty);
      if (distance <= CLOTH_BALANCE.pastoralReach && (!nearest || distance < nearest.distance)) nearest = { id: farm.id, distance };
    }
    if (nearest) owners.set(at, nearest.id);
  }
  const reserved = new Set<number>();
  for (const site of state.constructionSites) {
    const size = constructionSiteFootprint(site);
    for (let y = size.ty; y < size.ty + size.height; y++) for (let x = size.tx; x < size.tx + size.width; x++) reserved.add(y * state.width + x);
  }
  const boxes = [...washPoolReservations(state, scene)], result: WashPoolProp[] = [];
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < state.width && y < state.height ? state.tiles[y * state.width + x] : undefined;
  const chosen = new Set<string>();
  for (const entry of eligible) for (const farm of farms) {
    const policy = entry.pastureYard, group = `${farm.id}:${policy?.group ?? entry.id}`;
    if (chosen.has(group)) continue;
    if (policy?.positiveStock && !(Object.entries(farm.inventory).some(([resource, amount]) => resource === policy.positiveStock && amount > 0))) continue;
    chosen.add(group);
    const candidates = [...owners].filter(([, id]) => id === farm.id).map(([cell]) => cell)
      .sort((a, b) => yardHash(`${farm.id}:${a}`, state.seed) - yardHash(`${farm.id}:${b}`, state.seed) || a - b);
    for (const cell of candidates) {
      const tx = cell % state.width, ty = Math.floor(cell / state.width);
      let nearWater = false;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 2 && at(tx + dx, ty + dy)?.terrain === 'water') nearWater = true;
      if (!entry.pastureYard && !nearWater) continue;
      const cells = washPoolSupport(entry, tx, ty);
      if (cells.some(p => { const tile = at(p.tx, p.ty), index = p.ty * state.width + p.tx;
        return !tile || tile.terrain !== 'grass' || tile.hasRoad || tile.buildingId !== null || reserved.has(index) || owners.get(index) !== farm.id; })) continue;
      const box = washPoolBox(entry, tx, ty); if (boxes.some(other => boxesOverlap(box, other))) continue;
      result.push({ id: entry.pastureYard ? `facility:${entry.pastureYard.group}:${farm.id}` : `wash-pool:${farm.id}`, assetId: entry.id, farmId: farm.id, tx, ty }); boxes.push(box); break;
    }
  }
  let byEntry = cache.get(state); if (!byEntry) { byEntry = new WeakMap(); cache.set(state, byEntry); } byEntry.set(entries, { scene, props: result });
  return result;
}
