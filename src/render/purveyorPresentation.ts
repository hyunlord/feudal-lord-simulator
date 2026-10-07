import type { GameState } from '../engine/engine.types';
import type { Building } from '../content/buildingConfig';
type TileCoordinate = { readonly tx: number; readonly ty: number };
import { buildingRoadAccessTiles } from '../engine/routing';
import { shortestExistingRoadPath } from '../world/roadGraph';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { constructionSiteFootprint } from '../economy/constructionSiteAccessors';
import { groundBoundaryScene } from './groundBoundaryScene';
import { alignedRoadPosition, alignmentIndex } from './walkerRoadAlignment';
import type { WalkerPresentationDirection } from './walkerPresentation';

/** Saved-time presentation window, not a simulated actor or a claim about historical dwell time. */
export const PURVEYOR_PRESENTATION_TICKS = 250;
export type PurveyorEpisode = {
  readonly id: string; readonly receiptId: string; readonly buildingId: string;
  readonly logical: TileCoordinate; readonly foot: TileCoordinate;
  readonly direction: WalkerPresentationDirection; readonly gaitFrame: 0 | 1;
};
type Box = { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };
const inside = (p: TileCoordinate, b: Box): boolean => p.tx >= b.x0 && p.ty >= b.y0 && p.tx < b.x1 && p.ty < b.y1;
function roadPlace(state: GameState, building: Building): { logical: TileCoordinate; foot: TileCoordinate } | null {
  const access = buildingRoadAccessTiles(state, building);
  if (!access.length) return null;
  const scene = groundBoundaryScene(state);
  const alignment = alignmentIndex(scene.roads, state.width, state.height, state.tiles);
  const boxes: Box[] = state.buildings.map(b => {
    const size = buildingFootprint(b);
    return { x0: b.tx - .5, y0: b.ty - .5, x1: b.tx + size.width - .5, y1: b.ty + size.height - .5 };
  });
  for (const site of state.constructionSites) {
    const size = constructionSiteFootprint(site);
    boxes.push({ x0: size.tx - .5, y0: size.ty - .5, x1: size.tx + size.width - .5, y1: size.ty + size.height - .5 });
  }
  const plazas = new Set(scene.roads.fixedPoints.filter(p => p.kinds.includes('plaza')).map(p => `${p.tx},${p.ty}`));
  const candidates = [];
  for (const tile of state.tiles) {
    if (!tile.hasRoad || tile.terrain === 'water' || tile.buildingId !== null || Math.max(Math.abs(tile.tx - building.tx), Math.abs(tile.ty - building.ty)) > 3) continue;
    if (plazas.has(`${tile.tx},${tile.ty}`)) continue;
    const logical = { tx: tile.tx, ty: tile.ty };
    const foot = alignedRoadPosition(alignment, logical);
    if (boxes.some(box => inside(foot, box))) continue;
    if (state.walkers.some(w => Math.hypot(w.position.tx - foot.tx, w.position.ty - foot.ty) < .5)) continue;
    const path = shortestExistingRoadPath(state, access, [logical]);
    if (!path || path.length > 4) continue;
    candidates.push({ logical, foot, distance: path.length - 1 });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.logical.ty - b.logical.ty || a.logical.tx - b.logical.tx);
  return candidates[0] ?? null;
}
const cache = new WeakMap<GameState, readonly PurveyorEpisode[]>();
export function purveyorEpisodes(state: GameState): readonly PurveyorEpisode[] {
  const cached = cache.get(state); if (cached) return cached;
  const latest = new Map<string, { readonly building: Building; readonly id: string; readonly tick: number }>();
  for (const entry of state.ledger?.entries ?? []) {
    const age = state.tick - entry.tick;
    if (entry.category !== 'purveyance' || entry.account !== 'cash' || entry.amount <= 0 || age < 0 || age >= PURVEYOR_PRESENTATION_TICKS) continue;
    if (!entry.sourceRefs.some(ref => ref.type === 'actor' && ref.id === 'crown')) continue;
    for (const ref of entry.sourceRefs) {
      if (ref.type !== 'building') continue;
      const building = state.buildings.find(b => b.id === ref.id && b.kind === 'granary');
      if (!building) continue;
      const old = latest.get(building.id);
      if (!old || old.tick < entry.tick || (old.tick === entry.tick && old.id < entry.id)) latest.set(building.id, { building, id: entry.id, tick: entry.tick });
    }
  }
  const episodes: PurveyorEpisode[] = [];
  if (latest.size === 0) { cache.set(state, episodes); return episodes; }
  for (const receipt of [...latest.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const at = roadPlace(state, receipt.building); if (!at) continue;
    if (episodes.some(e => Math.hypot(e.foot.tx - at.foot.tx, e.foot.ty - at.foot.ty) < .5)) continue;
    const dx = receipt.building.tx - at.foot.tx, dy = receipt.building.ty - at.foot.ty;
    const direction = Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? 'SE' : 'NW') : (dy >= 0 ? 'SW' : 'NE');
    episodes.push({ id: `purveyor:${receipt.id}`, receiptId: receipt.id, buildingId: receipt.building.id, ...at, direction, gaitFrame: 0 });
  }
  cache.set(state, episodes); return episodes;
}
