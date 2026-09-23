import { BALANCE } from '../content/balanceConfig';
import type { GameState } from '../engine/engine.types';
import { palisadePerimeterSteps, type PalisadePath } from '../world/palisadeGeometry';
import { placementSpendableResource } from '../world/placement';
import { previewPalisadeRouteAccess } from '../engine/palisadeRouteAccess';
import { A_TRIPLE_PRIME_WALL_COPY } from './aTriplePrimeWallCopy';
import type { PredictionLine } from './predictionTypes';

const TIMBER_PER_STEP = 15;
const STEPS_PER_SEGMENT = 4;
const BUILDER_TICKS_PER_SEGMENT = 120;
const MAX_BUILDERS_PER_SEGMENT = 3;

export function proposalPredictionLines(state: GameState, path: PalisadePath): readonly PredictionLine[] {
  const steps = palisadePerimeterSteps(path);
  const segments = Math.ceil(steps / STEPS_PER_SEGMENT);
  const cost = steps * TIMBER_PER_STEP;
  const available = placementSpendableResource(state, 'timber');
  const deficit = Math.max(0, cost - available);
  const labourTicks = segments * BUILDER_TICKS_PER_SEGMENT;
  const lines: PredictionLine[] = [
    { id: 'scope', tone: 'neutral', text: `길이 ${steps}칸 · 공사 ${segments}구간 · 목재 ${cost} · 인력 ${labourTicks}일꾼틱` },
    { id: 'materials', tone: deficit > 0 ? 'warning' : 'positive', text: `가용 목재 ${available} · 추가 필요 ${deficit}` },
  ];
  const unreachable = previewPalisadeRouteAccess(state, path).unreachableSiteIds.length;
  if (unreachable > 0) {
    lines.push({ id: 'no-route', tone: 'warning', text: A_TRIPLE_PRIME_WALL_COPY.unreachableSegments(unreachable) });
  }
  const window = state.timberProductionWindow;
  if (deficit > 0 && (window === undefined || window.throughTick - window.startTick + 1 < 1200)) {
    lines.push({ id: 'eta', tone: 'neutral', text: '예상 완공: 최근 목재 생산 기록 부족' });
  } else if (deficit > 0 && window !== undefined && window.produced === 0) {
    lines.push({ id: 'eta', tone: 'warning', text: '예상 완공: 최근 목재 생산 0 · 시간 계산 불가' });
  } else {
    const productionTicks = deficit === 0 || window === undefined
      ? 0 : Math.ceil(deficit * (window.throughTick - window.startTick + 1) / window.produced);
    const minimumTicks = Math.max(productionTicks, Math.ceil(labourTicks / MAX_BUILDERS_PER_SEGMENT));
    const minutes = Math.max(1, Math.ceil(minimumTicks / (BALANCE.TICKS_PER_SECOND * 60)));
    lines.push({ id: 'eta', tone: 'neutral', text: `예상 완공 최소 약 ${minutes}분 (1× · 최근 실생산 기준, 운송 제외)` });
  }
  if (available <= cost + Math.floor(available * 0.25)) {
    lines.push({ id: 'reserve-risk', tone: 'warning', text: '공사 중 가용 목재가 비축분 근처까지 낮아질 수 있습니다' });
  }
  return lines;
}
