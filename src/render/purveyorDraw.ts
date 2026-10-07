import type { GameState } from '../engine/engine.types';
import { purveyorEpisodes, type PurveyorEpisode } from './purveyorPresentation';
import { depthKey, tileToScreen } from './iso';
import { tileIsVisibleInRange, type TileRange } from './renderVisibility';
import { drawExplicitWalkerLook } from './explicitWalkerLook';

export function purveyorQueueItems(state: GameState, range: TileRange) {
  return purveyorEpisodes(state).filter(e => tileIsVisibleInRange(e.logical.tx, e.logical.ty, range)).map(episode => ({
    kind: 'purveyor' as const, id: episode.id, episode, foot: episode.foot,
    depth: depthKey(episode.foot.tx, episode.foot.ty), anchorTx: episode.foot.tx,
  }));
}
export function drawPurveyor(context: CanvasRenderingContext2D, episode: PurveyorEpisode): boolean {
  const at = tileToScreen(episode.foot.tx, episode.foot.ty);
  return drawExplicitWalkerLook(context, 'wk_royal_purveyor', 'wave17_ledger', episode.direction, episode.gaitFrame, at.sx, at.sy);
}
