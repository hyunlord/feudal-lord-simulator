import type { GameState } from '../engine/engine.types';
import { LEVY_RESPONSE_PETITION_ID } from '../content/warConfig';
import { stateCalendar } from '../engine/scenarioState';
import { zonesOf } from '../zones/zoneEdits';
import type { ArtRect, EventSceneEntry } from './art/artContract';
import { musterTerrainClearance } from './musterFieldTerrain';
import { musterFieldReservations } from './musterFieldReservations';
import { worldFireReserved } from './worldFirePlacement';
import { boxesOverlap } from './tradeWorldPlacement';
import { screenToTile, tileToScreen } from './iso';

export const MUSTER_FIELD_TICKS = 250;
export type MusterFieldProp = { readonly id: string; readonly assetId: string; readonly tx: number; readonly ty: number; readonly petitionId: string };
export function activeMusterPetition(state: GameState) {
  const conscripts = state.war?.conscripts;
  if (!conscripts || conscripts.men <= 0 || conscripts.returned || state.tick >= conscripts.returnTick || stateCalendar(state).season === 3) return null;
  return state.politics?.petitions.find(p => p.defId === LEVY_RESPONSE_PETITION_ID && p.response === 'accept'
    && p.respondedTick !== undefined && state.tick >= p.respondedTick && state.tick < p.respondedTick + MUSTER_FIELD_TICKS) ?? null;
}
type Anchor = { readonly tx: number; readonly ty: number } | null;
let lastAnchor: { tiles: GameState['tiles']; entry: EventSceneEntry; key: string; value: Anchor } | null = null;
/** Choose the widest original meadow outside the saved source homes; occupancy never reselects it. */
export function musterFieldAnchor(state: GameState, entry: EventSceneEntry): { tx: number; ty: number } | null {
  const id = state.war?.conscripts?.houseIds[0];
  const source = state.buildings.find(b => b.id === id && b.kind === 'house');
  if (!source) return null;
  const ids = new Set(state.war!.conscripts!.houseIds);
  const homes = state.buildings.filter(b => ids.has(b.id));
  if (homes.length !== ids.size) return null;
  const key = `${id}:${state.width}:${state.height}:${homes.map(b => `${b.id}@${b.tx},${b.ty}`).join('|')}:${(state.drainage?.drained ?? []).join(',')}`;
  if (lastAnchor?.tiles === state.tiles && lastAnchor.entry === entry && lastAnchor.key === key) return lastAnchor.value;
  const left = Math.min(...homes.map(b => b.tx)) - 3, right = Math.max(...homes.map(b => b.tx)) + 4;
  const top = Math.min(...homes.map(b => b.ty)) - 3, bottom = Math.max(...homes.map(b => b.ty)) + 4;
  const clearance = musterTerrainClearance(state);
  const candidates: { tx: number; ty: number; distance: number; clearance: number }[] = [];
  for (let ty = Math.max(0, source.ty - 24); ty < Math.min(state.height, source.ty + 25); ty++)
    for (let tx = Math.max(0, source.tx - 24); tx < Math.min(state.width, source.tx + 25); tx++) {
      const distance = (tx - source.tx) ** 2 + (ty - source.ty) ** 2;
      const cells = musterFieldSupport(entry, tx, ty);
      const outsideHomes = cells.every(p => p.tx < left) || cells.every(p => p.tx > right) || cells.every(p => p.ty < top) || cells.every(p => p.ty > bottom);
      if (outsideHomes && terrainAllows(state, cells)) {
        const reach = Math.min(...cells.map(p => p.tx >= 0 && p.ty >= 0 && p.tx < state.width && p.ty < state.height ? clearance[p.ty * state.width + p.tx]! : 0));
        if (reach > 0) candidates.push({ tx, ty, distance, clearance: reach });
      }
    }
  candidates.sort((a, b) => b.clearance - a.clearance || a.distance - b.distance || a.ty - b.ty || a.tx - b.tx);
  const first = candidates[0], value = first ? { tx: first.tx, ty: first.ty } : null;
  lastAnchor = { tiles: state.tiles, entry, key, value }; return value;
}
function terrainAllows(state: GameState, cells: readonly { tx: number; ty: number }[]): boolean {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < state.width && y < state.height ? state.tiles[y * state.width + x] : undefined;
  return cells.every(p => {
    if (at(p.tx, p.ty)?.terrain !== 'grass') return false;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (at(p.tx + dx, p.ty + dy)?.terrain === 'forest') return false;
    return true;
  });
}
export function musterFieldBox(entry: EventSceneEntry, tx: number, ty: number): ArtRect {
  const at = tileToScreen(tx, ty), { pivot, scale } = entry.geometry;
  return { x: at.sx - pivot.x * scale, y: at.sy - pivot.y * scale, width: entry.image.width * scale, height: entry.image.height * scale };
}
/** Full raster reach, not just the nominal 2x2 grass footprint. */
export function musterFieldSupport(entry: EventSceneEntry, tx: number, ty: number) {
  const b = musterFieldBox(entry, tx, ty);
  const corners = [screenToTile(b.x, b.y), screenToTile(b.x + b.width, b.y), screenToTile(b.x, b.y + b.height), screenToTile(b.x + b.width, b.y + b.height)];
  const cells: { tx: number; ty: number }[] = [];
  for (let y = Math.floor(Math.min(ty - 1, ...corners.map(p => p.ty)) + 0.5); y <= Math.floor(Math.max(ty, ...corners.map(p => p.ty)) + 0.5); y++)
    for (let x = Math.floor(Math.min(tx - 1, ...corners.map(p => p.tx)) + 0.5); x <= Math.floor(Math.max(tx, ...corners.map(p => p.tx)) + 0.5); x++) cells.push({ tx: x, ty: y });
  return cells;
}
const cache = new WeakMap<GameState, WeakMap<EventSceneEntry, readonly MusterFieldProp[]>>();
export function musterFieldProps(state: GameState, entry: EventSceneEntry | null): readonly MusterFieldProp[] {
  const petition = activeMusterPetition(state);
  if (!entry || !petition) return [];
  const cached = cache.get(state)?.get(entry); if (cached) return cached;
  const at = musterFieldAnchor(state, entry);
  if (!entry || !petition || !at) return [];
  const support = musterFieldSupport(entry, at.tx, at.ty), reserved = worldFireReserved(state);
  for (const zone of zonesOf(state)) for (const index of zone.membership) reserved.add(`${index % state.width},${Math.floor(index / state.width)}`);
  const tileAt = (x: number, y: number) => x >= 0 && y >= 0 && x < state.width && y < state.height ? state.tiles[y * state.width + x] : undefined;
  // Nearby forest silhouettes can reach beyond their ground cell; reserve a conservative three-cell skirt.
  const unsafe = support.some(p => {
    const tile = tileAt(p.tx, p.ty);
    if (!tile || tile.terrain !== 'grass' || tile.hasRoad || tile.buildingId !== null || reserved.has(`${p.tx},${p.ty}`)) return true;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (tileAt(p.tx + dx, p.ty + dy)?.terrain === 'forest') return true;
    return false;
  });
  const box = musterFieldBox(entry, at.tx, at.ty);
  const occupied = unsafe || musterFieldReservations(state).some(other => boxesOverlap(box, other));
  const result = occupied ? [] : [{ id: `muster:${petition.id}`, assetId: entry.id, petitionId: petition.id, ...at }];
  let entries = cache.get(state); if (!entries) { entries = new WeakMap(); cache.set(state, entries); } entries.set(entry, result);
  return result;
}
