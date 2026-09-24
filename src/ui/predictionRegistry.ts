import { PlacementFailure } from '../world/placement';
import type { PredictionLine } from './predictionTypes';

export const PLACEMENT_REASON_LABELS = {
  [PlacementFailure.occupied]: '점유 충돌',
  [PlacementFailure.wall_clearance]: '성벽과 너무 가까움',
  [PlacementFailure.wrong_terrain]: '설치할 수 없는 지형',
  [PlacementFailure.out_of_bounds]: '영지 밖',
  [PlacementFailure.needs_road]: '도로에서 너무 멂',
  [PlacementFailure.needs_adjacent_terrain]: '필요한 지형이 인접하지 않음',
  [PlacementFailure.insufficient_materials]: '자재 부족',
  [PlacementFailure.locked_era]: '아직 해금되지 않은 시설',
} as const satisfies Record<PlacementFailure, string>;

export function predictionCheck(id: string, label: string, ok: boolean, detail = ''): PredictionLine {
  return { id, severity: ok ? 'ok' : 'block', text: `${label}${detail === '' ? '' : ` ${detail}`}`, sources: [] };
}
