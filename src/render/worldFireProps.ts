import type { Tile } from '../world/world.types';
import type { GameState } from '../engine/engine.types';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { depthKey } from './iso';
import { sortRenderItems } from './objectRenderSort';
import type { RenderQueueItem } from './objectRenderTypes';
import { tileIsVisibleInRange, type TileRange } from './renderVisibility';
import { WORLD_FIRE_ART, type WorldFireProp, type WorldFireSelector } from './worldFireArt';
import { worldFireBrigadeAnchor, worldFireReserved } from './worldFirePlacement';

/** Actual engine records only. Five groups represent at most 35 drawn actors, never new residents. */
export function worldFireProps(state: GameState, select: WorldFireSelector = WORLD_FIRE_ART.select): readonly WorldFireProp[] {
  const active = state.events?.burning.filter(entry => entry.ignitedTick <= state.tick && state.tick < entry.outTick) ?? [];
  if (active.length === 0) return [];
  const props: WorldFireProp[] = [];
  let reserved: Set<string> | undefined;
  let tileLookup: ReadonlyMap<string, Tile> | undefined;
  let groups = 0;
  for (const burning of [...active].sort((a, b) => a.buildingId.localeCompare(b.buildingId))) {
    const building = state.buildings.find(candidate => candidate.id === burning.buildingId && candidate.kind === 'house');
    if (building === undefined) continue;
    const put = (role: WorldFireProp['role'], assetId: string, tx: number, ty: number): void => {
      props.push({ id: `world-fire:${role}:${building.id}`, buildingId: building.id, eventId: burning.eventId, role, assetId, tx, ty });
    };
    const flame = select(state, burning.eventId, 'fire-flame');
    if (flame !== null) {
      const size = buildingFootprint(building);
      put('fire-flame', flame.id, building.tx + size.width - 0.12, building.ty + size.height - 0.12);
    }
    if (!burning.doused || groups >= 5) continue;
    const brigade = select(state, burning.eventId, 'bucket-brigade');
    if (brigade === null) continue;
    reserved ??= worldFireReserved(state);
    tileLookup ??= new Map(state.tiles.map(tile => [`${tile.tx},${tile.ty}`, tile]));
    const point = worldFireBrigadeAnchor(state, building, brigade, reserved, tileLookup);
    if (point === null) continue;
    put('bucket-brigade', brigade.id, point.tx, point.ty); groups++;
  }
  return props;
}
export function withWorldFireProps(queue: readonly RenderQueueItem[], state: GameState, range: TileRange, select: WorldFireSelector = WORLD_FIRE_ART.select): readonly RenderQueueItem[] {
  const props = worldFireProps(state, select).filter(prop => tileIsVisibleInRange(prop.tx, prop.ty, range));
  if (props.length === 0) return queue;
  return sortRenderItems([...queue, ...props.map(prop => ({ kind: 'world_fire' as const, id: prop.id, prop, depth: depthKey(prop.tx, prop.ty), anchorTx: prop.tx }))]);
}
/** The actual same-frame visible queue is the receipt; absent art keeps legacy buckets. */
export function worldFireBrigadeIds(queue: readonly RenderQueueItem[]): ReadonlySet<string> | undefined {
  if (!queue.some(item => item.kind === 'world_fire' && item.prop.role === 'bucket-brigade')) return undefined;
  return new Set(queue.flatMap(item => item.kind === 'world_fire' && item.prop.role === 'bucket-brigade' ? [item.prop.buildingId] : []));
}
