import type { GameState } from '../engine/engine.types';
import type { BoundaryPoint } from '../world/boundary/boundaryGeometry';
import { YARD_SUBCELLS } from '../world/boundary/buildingGrounds';
import type { GroundBoundaryScene } from './groundBoundaryScene';
import { pointInPolygon } from './groundSceneParts';

export type CollapsedFenceBinding = {
  readonly panelId: string; readonly buildingId: string; readonly tx: number; readonly ty: number;
};
type FenceScene = Pick<GroundBoundaryScene, 'yardProps' | 'grounds'>;

/** Occupancy is deliberately read outside the geometry cache: a resettled house recovers its panel immediately. */
export function abandonedFenceOwners(state: Pick<GameState, 'houses' | 'tick'>): readonly string[] {
  return state.houses.filter(house => house.residents <= 0 && house.abandonedTick !== undefined
    && house.abandonedTick <= state.tick && house.burntTick === undefined).map(house => house.buildingId);
}

export function collapsedFenceBindings(state: Pick<GameState, 'houses' | 'tick'>, scene: FenceScene): readonly CollapsedFenceBinding[] {
  const owners = new Set(abandonedFenceOwners(state));
  const selected = new Set<string>();
  const bindings: CollapsedFenceBinding[] = [];
  for (const piece of [...scene.yardProps.hurdles].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!owners.has(piece.buildingId) || selected.has(piece.buildingId) || piece.kind !== 'straight' || !piece.mirror) continue;
    const yard = scene.grounds.yards.find(candidate => candidate.buildingId === piece.buildingId);
    if (yard === undefined) continue;
    const f = yard.footprint;
    const ny = piece.anchor.y === f.ty - 1 ? -1 : piece.anchor.y === f.ty + f.height ? 1 : 0;
    if (ny === 0 || scene.grounds.aprons.some(apron => apron.buildingId === piece.buildingId && apron.normal.x === 0 && apron.normal.y === ny)) continue;
    const anchor = { x: piece.anchor.x - 0.5, y: piece.anchor.y - ny * 0.25 };
    const cells = new Set(yard.subcells);
    let contained = true;
    for (const dx of [-0.1875, -0.0625, 0.0625, 0.1875]) for (const dy of [-0.1875, -0.0625, 0.0625, 0.1875]) {
      const x = anchor.x + dx, y = anchor.y + dy;
      const key = Math.floor((y + 0.5) * YARD_SUBCELLS) * yard.subcellStride + Math.floor((x + 0.5) * YARD_SUBCELLS);
      if (!cells.has(key) || (x >= f.tx - 0.5 && x < f.tx + f.width - 0.5 && y >= f.ty - 0.5 && y < f.ty + f.height - 0.5)) contained = false;
    }
    if (!contained || scene.grounds.aprons.some(apron => overlapsFootprint(anchor, apron.polygon))) continue;
    bindings.push({ panelId: piece.id, buildingId: piece.buildingId, tx: anchor.x, ty: anchor.y });
    selected.add(piece.buildingId);
  }
  return bindings;
}

/** Reject even an apron sliver crossing between the yard subcell samples. */
function overlapsFootprint(at: BoundaryPoint, polygon: readonly BoundaryPoint[]): boolean {
  const minX = at.x - 0.25, maxX = at.x + 0.25, minY = at.y - 0.25, maxY = at.y + 0.25;
  if ([{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }]
    .some(corner => pointInPolygon(corner, polygon))) return true;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index], b = polygon[(index + 1) % polygon.length];
    if (a === undefined || b === undefined) continue;
    let enter = 0, leave = 1;
    for (const [start, delta, low, high] of [[a.x, b.x - a.x, minX, maxX], [a.y, b.y - a.y, minY, maxY]] as const) {
      if (delta === 0) { if (start < low || start > high) { enter = 1; leave = 0; } }
      else { const t1 = (low - start) / delta, t2 = (high - start) / delta;
        enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2)); }
    }
    if (enter <= leave) return true;
  }
  return false;
}
