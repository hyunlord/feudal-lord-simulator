import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import type { TileCoordinate } from '../world/grid';
import { computePalisadeProposal, footprintCorners, isPointInsidePalisade, validatePalisadeCandidate, type PalisadeFootprint } from '../world/palisadeGeometry';
import type { GameState } from './engine.types';
import { palisadeFootprintsForState } from './palisadeFootprints';

type WallSpace = {
  readonly footprints: readonly PalisadeFootprint[];
  readonly feasible: boolean;
  readonly candidates: Map<string, boolean>;
};
const wallSpaceByState = new WeakMap<GameState, WallSpace>();
const wallSpaceByTiles = new WeakMap<GameState['tiles'], { readonly layout: string; readonly space: WallSpace }>();

/** Called only after ordinary legality and ranking; never restricts manual placement. */
export function preservesAutoplayWallSpace(state: GameState, kind: BuildingKind, origin: TileCoordinate): boolean {
  if (state.era !== 'hamlet') {
    const boundary = state.palisade;
    if (kind !== 'house' || boundary === null) return true;
    const { width, height } = BUILDING_CONFIG_BY_KIND[kind];
    return footprintCorners({ id: 'autoplay-wall-candidate', ...origin, width, height })
      .every(corner => isPointInsidePalisade(corner, boundary.polygon));
  }
  let space = wallSpaceByState.get(state);
  if (space === undefined) {
    const footprints = palisadeFootprintsForState(state);
    const layout = JSON.stringify([state.width, state.height, footprints]);
    const previous = wallSpaceByTiles.get(state.tiles);
    if (previous?.layout === layout) space = previous.space;
    else {
      const proposal = computePalisadeProposal(state, footprints);
      space = { footprints, feasible: proposal.ok && validatePalisadeCandidate(state, proposal.path, footprints).ok, candidates: new Map() };
      wallSpaceByTiles.set(state.tiles, { layout, space });
    }
    wallSpaceByState.set(state, space);
  }
  if (!space.feasible) return true;
  const { width, height } = BUILDING_CONFIG_BY_KIND[kind];
  const key = `${origin.tx},${origin.ty},${width},${height}`;
  const cached = space.candidates.get(key);
  if (cached !== undefined) return cached;
  const footprints = [...space.footprints, { id: 'autoplay-wall-candidate', ...origin, width, height }];
  const proposal = computePalisadeProposal(state, footprints);
  const feasible = proposal.ok && validatePalisadeCandidate(state, proposal.path, footprints).ok;
  space.candidates.set(key, feasible);
  return feasible;
}
