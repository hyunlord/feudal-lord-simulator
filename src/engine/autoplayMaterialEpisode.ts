import type { GameState } from './engine.types';
import type { MaterialEpisode } from './autoplayMaterialTypes';
export function materialEpoch(state: GameState): number | null {
  const epoch = state.eraProclaimedTick;
  return state.era === 'stone_town' && epoch !== null && Number.isSafeInteger(epoch) && epoch >= 0 && epoch <= state.tick ? epoch : null;
}
export function materialWallOpen(state: GameState, wallId: string): boolean {
  if (state.palisade?.id !== wallId) return false;
  return state.constructionSites.some(site => (site.kind === 'stone_wall_segment' || site.kind === 'palisade_segment') && site.wallId === wallId)
    || state.palisade?.id === wallId && state.palisade.segments.some(segment => segment.material !== 'stone' || !segment.completed || segment.replacementConstructionSiteId !== null && segment.replacementConstructionSiteId !== undefined);
}
export function currentMaterialEpisode(state: GameState): MaterialEpisode | null {
  const epoch = materialEpoch(state);
  if (epoch === null) return null;
  const walls = new Set(state.constructionSites.flatMap(site => site.kind === 'stone_wall_segment' || site.kind === 'palisade_segment' ? [site.wallId] : []));
  if (state.palisade !== null) walls.add(state.palisade.id);
  const wallId = [...walls].sort().find(id => materialWallOpen(state, id));
  return wallId === undefined ? null : { wallId, epoch };
}
