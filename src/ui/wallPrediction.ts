import type { GameState } from '../engine/engine.types';
import { palisadePerimeterSteps, type PalisadePath } from '../world/palisadeGeometry';
import { placementSpendableResource } from '../world/placement';
import { previewPalisadeDraftRouteAccess, previewPalisadeRouteAccess, type PalisadeRouteAccess } from '../engine/palisadeRouteAccess';
import { A_TRIPLE_PRIME_WALL_COPY } from './aTriplePrimeWallCopy';
import { A_QUADRUPLE_PRIME_WALL_COPY } from './aQuadruplePrimeWallCopy';
import { suggestedConstructionRoad } from './constructionAccessModel';
import { getTile } from '../world/grid';
import type { PredictionLine } from './predictionTypes';
import { WALL_CARRY_COPY } from './wallCarryCopy.ko';
import { GAME_TIME_COPY } from './gameTimeCopy.ko';
import { calendarArrivalLabel } from './calendarArrival';
import { scenarioOf } from '../engine/scenarioState';
import { WALL_ETA_COPY } from './calendarArrivalCopy.ko';

const TIMBER_PER_STEP = 15;
const STEPS_PER_SEGMENT = 4;
const BUILDER_TICKS_PER_SEGMENT = 120;
const MAX_BUILDERS_PER_SEGMENT = 3;
type AnchorCandidate = Readonly<{ siteId: string; roadTiles: number }>;
const predictedRoadCache = new WeakMap<PalisadeRouteAccess, AnchorCandidate | null>();

export function proposalPredictionLines(state: GameState, path: PalisadePath): readonly PredictionLine[] {
  return predictionLines(state, path, previewPalisadeRouteAccess(state, path));
}

export function draftPalisadePredictionLines(state: GameState, path: PalisadePath): readonly PredictionLine[] {
  return predictionLines(state, path, previewPalisadeDraftRouteAccess(state, path));
}

export function nearestWallAnchorCandidate(access: PalisadeRouteAccess): AnchorCandidate | null {
  if (access.unreachableSiteIds.length === 0) return null;
  if (predictedRoadCache.has(access)) return predictedRoadCache.get(access) ?? null;
  let nearest: AnchorCandidate | null = null;
  for (const siteId of access.unreachableSiteIds) {
    const site = access.projected.constructionSites.find(candidate => candidate.id === siteId);
    if (site === undefined) continue;
    const suggestion = suggestedConstructionRoad(access.projected, site)
      .filter(tile => getTile(access.projected, tile)?.hasRoad !== true);
    if (suggestion.length === 0) continue;
    if (nearest === null || suggestion.length < nearest.roadTiles
      || (suggestion.length === nearest.roadTiles && siteId < nearest.siteId)) {
      nearest = { siteId, roadTiles: suggestion.length };
    }
  }
  predictedRoadCache.set(access, nearest);
  return nearest;
}

function predictionLines(state: GameState, path: PalisadePath, access: PalisadeRouteAccess): readonly PredictionLine[] {
  const steps = palisadePerimeterSteps(path);
  const segments = Math.ceil(steps / STEPS_PER_SEGMENT);
  const cost = steps * TIMBER_PER_STEP;
  const available = placementSpendableResource(state, 'timber');
  const deficit = Math.max(0, cost - available);
  const labourTicks = segments * BUILDER_TICKS_PER_SEGMENT;
  const lines: PredictionLine[] = [
    { id: 'scope', severity: 'info', sources: [], text: `길이 ${steps}칸 · 공사 ${segments}구간 · 목재 ${cost} · 인력 ${GAME_TIME_COPY.oneWorkerLabour(labourTicks)}` },
    { id: 'materials', severity: deficit > 0 ? 'warn' : 'ok', sources: [], text: `가용 목재 ${available} · 추가 필요 ${deficit}` },
  ];
  const unreachable = access.unreachableSiteIds.length;
  const direct = access.segments.filter(segment => segment.access === 'direct').length;
  const carried = access.segments.filter(segment => segment.access === 'wall').length;
  lines.push({ id: 'wall-carry-access', severity: unreachable > 0 ? 'warn' : 'ok', sources: [],
    text: WALL_CARRY_COPY.access(direct, carried, unreachable) });
  if (direct === 0 && unreachable > 0) {
    lines.push({ id: 'wall-anchor-required', severity: 'warn', sources: [], text: WALL_CARRY_COPY.anchorRequired });
  }
  if (access.provisional) {
    lines.push({ id: 'route-provisional', severity: unreachable > 0 ? 'warn' : 'info', sources: [],
      text: A_QUADRUPLE_PRIME_WALL_COPY.provisionalRoute(unreachable) });
  }
  if (unreachable > 0 && !access.provisional) {
    lines.push({ id: 'no-route', severity: 'warn', sources: [], text: WALL_CARRY_COPY.unreachable(unreachable) });
  }
  if (unreachable > 0) {
    const roadTiles = nearestWallAnchorCandidate(access)?.roadTiles ?? null;
    lines.push({ id: 'road-length', severity: 'warn', sources: [], text: roadTiles === null
      ? A_QUADRUPLE_PRIME_WALL_COPY.noConnectingRoad
      : A_QUADRUPLE_PRIME_WALL_COPY.connectingRoads(roadTiles) });
  }
  if (access.unavailableSiteIds.length > 0) {
    lines.push({ id: 'no-source', severity: 'warn', sources: [],
      text: A_TRIPLE_PRIME_WALL_COPY.unavailableSegments(access.unavailableSiteIds.length) });
  }
  const window = state.timberProductionWindow;
  if (deficit > 0 && (window === undefined || window.throughTick - window.startTick + 1 < 1200)) {
    lines.push({ id: 'eta', severity: 'info', sources: [], text: '예상 완공: 최근 목재 생산 기록 부족' });
  } else if (deficit > 0 && window !== undefined && window.produced === 0) {
    lines.push({ id: 'eta', severity: 'warn', sources: [], text: '예상 완공: 최근 목재 생산 0 · 시간 계산 불가' });
  } else {
    const productionTicks = deficit === 0 || window === undefined
      ? 0 : Math.ceil(deficit * (window.throughTick - window.startTick + 1) / window.produced);
    const minimumTicks = Math.max(productionTicks, Math.ceil(labourTicks / MAX_BUILDERS_PER_SEGMENT));
    // F0-V: the earliest completion as a calendar arrival point (never a duration).
    const when = calendarArrivalLabel(state.tick, state.tick + minimumTicks, scenarioOf(state).startYear);
    lines.push({ id: 'eta', severity: 'info', sources: [], text: WALL_ETA_COPY.earliest(when) });
  }
  if (available <= cost + Math.floor(available * 0.25)) {
    lines.push({ id: 'reserve-risk', severity: 'warn', sources: [], text: '공사 중 가용 목재가 비축분 근처까지 낮아질 수 있습니다' });
  }
  return lines;
}
