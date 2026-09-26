import { computePalisadeProposal, dragPalisadeRun, isPointInsidePalisade, palisadePathEnclosesFootprints, palisadePathHasBuildingClearance, validatePalisadeCandidate, type PalisadeFootprint, type PalisadePath } from '../world/palisadeGeometry';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { housingLotsStillNeeded, interiorHouseSites } from './autoplayInteriorPlots';
import { previewPalisadeExpansion } from './palisade';
import { palisadeCoreBuildingFootprintsForState, palisadeCoreFootprintsForState, palisadeFootprintsForState } from './palisadeFootprints';

/**
 * BOT-2 (AR-11, spec docs/design/autoplay-recovery.md): room in the palisade for the lots still wanted.
 *
 * A hamlet that meets the palisade requirements before its lots are in proclaims around the hull of its buildings.
 * Seed 3 (EV8, FC11) proclaimed at 9 of 24 lots with water on two sides: 131 cells, 32 of them road, and the last
 * lots never fitted. The bot now asks the wall for room — free house cells for every lot still wanted, and roads at
 * most 30 % of the inside — and when no hull of the buildings has it, stretches the hull toward open land with a
 * planned-lots anchor on one side. The wall is still the proclamation panel's proposal (same geometry, same checks);
 * a player can drag a wall out the same way. Nothing here is a game rule.
 */

/** Free house cells (grass, no road or building, clear of the wall) the wall must hold for each lot still wanted. */
export const WALL_FREE_CELLS_PER_NEW_LOT = 6;
/** Roads may take at most this share of the cells inside. */
export const WALL_ROAD_SHARE_MAX = 0.3;
/** How far past the buildings a planned-lots anchor stretches the hull, nearest first. */
const STRETCH_TILES = [2, 4, 6, 8, 10] as const;

export type WallRoom = { readonly interior: number; readonly roads: number; readonly free: number; readonly roomy: boolean };

/** The room a candidate wall leaves, read from the tiles whose centre it encloses (as `cellInsideWall` does). */
export function wallRoom(state: Pick<GameState, 'tiles' | 'width' | 'height'>, path: PalisadePath, remainingLots: number): WallRoom {
  const inside = new Uint8Array(state.tiles.length);
  for (let index = 0; index < state.tiles.length; index += 1) {
    const tx = index % state.width;
    const ty = Math.floor(index / state.width);
    if (isPointInsidePalisade({ x: tx + 0.5, y: ty + 0.5 }, path)) inside[index] = 1;
  }
  let interior = 0;
  let roads = 0;
  let free = 0;
  for (let index = 0; index < state.tiles.length; index += 1) {
    if (inside[index] === 0) continue;
    interior += 1;
    const tile = state.tiles[index]!;
    if (tile.hasRoad) { roads += 1; continue; }
    if (tile.buildingId || tile.terrain !== 'grass') continue;
    const tx = index % state.width;
    const ty = Math.floor(index / state.width);
    // A house needs a gap to the wall: a cell whose neighbour is outside is not a house cell.
    const clear = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => {
      const x = tx + dx!;
      const y = ty + dy!;
      return x >= 0 && y >= 0 && x < state.width && y < state.height && inside[y * state.width + x] === 1;
    });
    if (clear) free += 1;
  }
  const roomy = free >= remainingLots * WALL_FREE_CELLS_PER_NEW_LOT && roads <= interior * WALL_ROAD_SHARE_MAX;
  return { interior, roads, free, roomy };
}

/**
 * Candidate walls stretched past the buildings: for each distance (nearest first) and side, a planned-lots anchor as
 * wide as the buildings joins the hull. Kept only when the wall encloses the core and clears every building, as the
 * panel's own proposal requires. At most `limit` proposal attempts.
 */
export function stretchedWallCandidates(state: GameState, limit = 40): readonly PalisadePath[] {
  const all = palisadeFootprintsForState(state);
  const core = palisadeCoreFootprintsForState(state);
  const anchors = palisadeCoreBuildingFootprintsForState(state);
  if (anchors.length === 0) return [];
  const x0 = Math.min(...anchors.map(footprint => footprint.tx));
  const x1 = Math.max(...anchors.map(footprint => footprint.tx + footprint.width - 1));
  const y0 = Math.min(...anchors.map(footprint => footprint.ty));
  const y1 = Math.max(...anchors.map(footprint => footprint.ty + footprint.height - 1));
  const accepts = (path: PalisadePath) => palisadePathEnclosesFootprints(path, core) && palisadePathHasBuildingClearance(path, all);
  const seen = new Set<string>();
  const paths: PalisadePath[] = [];
  let attempts = 0;
  for (const distance of STRETCH_TILES) {
    const sides: readonly PalisadeFootprint[] = [
      { id: 'zz-planned-lots-s', tx: x0, ty: y1 + distance, width: x1 - x0 + 1, height: 1 },
      { id: 'zz-planned-lots-n', tx: x0, ty: y0 - distance, width: x1 - x0 + 1, height: 1 },
      { id: 'zz-planned-lots-e', tx: x1 + distance, ty: y0, width: 1, height: y1 - y0 + 1 },
      { id: 'zz-planned-lots-w', tx: x0 - distance, ty: y0, width: 1, height: y1 - y0 + 1 },
    ];
    for (const anchor of sides) {
      if (anchor.tx < 0 || anchor.ty < 0 || anchor.tx + anchor.width > state.width || anchor.ty + anchor.height > state.height) continue;
      for (const margin of [2, 3]) {
        if (attempts++ >= limit) return paths;
        const proposal = computePalisadeProposal(state, [...anchors, anchor], accepts, [margin]);
        if (!proposal.ok) continue;
        const key = JSON.stringify(proposal.path);
        if (!seen.has(key)) { seen.add(key); paths.push(proposal.path); }
        break;
      }
    }
  }
  return paths;
}

/**
 * WALL-2 (AR-12): a built wall with fewer house sites inside than the lots still wanted is widened the way a player
 * would: one straight run of the wall dragged outward (1–10 steps, `dragPalisadeRun`). Of the drags the engine accepts
 * (`previewPalisadeExpansion`) with free house cells for every lot still wanted, the one with the fewest new steps
 * (the cheapest) is proclaimed. The roads inside already stand, so the road share is not asked here. The search is
 * kept per wall, lots and road revision (a wall that cannot be widened is not searched again each decision).
 */
const expansionSearch = new WeakMap<object, { readonly key: string; readonly path: PalisadePath | null }>();

export function autoplayWallExpansionAction(state: GameState, targetLots: number): AutoplayAction {
  const NONE = { kind: 'none' } as const;
  const palisade = state.palisade;
  if (palisade === null || !Number.isFinite(targetLots) || (state.era !== 'palisade' && state.era !== 'stone_town')) return NONE;
  if (palisade.expansion !== undefined || palisade.segments.some(segment => !segment.completed)) return NONE;
  const remaining = housingLotsStillNeeded(state, targetLots);
  if (remaining <= 0 || interiorHouseSites(state).length >= remaining) return NONE;
  const key = `${remaining}:${state.roadRevision}:${state.buildings.length}:${state.constructionSites.length}`;
  const cached = expansionSearch.get(palisade);
  if (cached?.key === key) return cached.path === null ? NONE : { kind: 'proclaim_era', candidatePath: cached.path };
  const all = palisadeFootprintsForState(state);
  const enclosed = all.filter(footprint => palisadePathEnclosesFootprints(palisade.polygon, [footprint]));
  const current = validatePalisadeCandidate(state, palisade.polygon, all, enclosed, 1);
  let best: { readonly path: PalisadePath; readonly newSteps: number } | null = null;
  if (current.ok) {
    for (let run = 0; run < current.candidate.runs.length; run += 1) {
      for (let steps = 1; steps <= 10; steps += 1) {
        const dragged = dragPalisadeRun(state, current.candidate, run, steps, all, enclosed, 1);
        if (!dragged.ok) continue;
        const preview = previewPalisadeExpansion(state, dragged.candidate.path);
        if (!preview.ok || (best !== null && preview.newSteps >= best.newSteps)) continue;
        if (wallRoom(state, preview.path, remaining).free >= remaining * WALL_FREE_CELLS_PER_NEW_LOT) { best = { path: preview.path, newSteps: preview.newSteps }; break; }
      }
    }
  }
  expansionSearch.set(palisade, { key, path: best?.path ?? null });
  return best === null ? NONE : { kind: 'proclaim_era', candidatePath: best.path };
}
