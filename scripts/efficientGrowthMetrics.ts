import type { GameState } from '../src/engine/engine.types';
import { foodEfficiencyMetrics } from '../src/engine/autoplayFoodEfficiency';
import { housingLotCount } from '../src/population/housing';
import { buildBuildingVisualState } from '../src/render/buildingVisualState';
import { problemMarkerKind } from '../src/render/drawBuildingDetails';
import { efficientAcceptance } from './efficientGrowthAcceptance';
import type { MillZeroWheatReport } from './efficientGrowthMillContinuity';

export function efficientGrowthMetrics(state: GameState, millObservation: MillZeroWheatReport) {
  const buildings = [...new Map(state.buildings.map(building => [building.id, building])).values()];
  const count = (kind: string) => buildings.filter(building => building.kind === kind).length;
  const food = foodEfficiencyMetrics(state);
  return efficientAcceptance({ ...food, lots: housingLotCount(state), farms: count('wheat_farm'), mills: count('mill'),
    chronicZeroWheatMills: millObservation.millIds.length,
    chronicZeroWheatKnown: millObservation.known,
    chronicZeroWheatObservedTicks: millObservation.stableTicks,
    granaries: count('granary'), markets: count('market'), churches: count('church'),
    population: state.population, idleWorkers: state.idleWorkers, buildings: buildings.length,
    warnings: buildings.filter(building => problemMarkerKind({ kind: building.kind,
      visualState: buildBuildingVisualState(building, state.houses) }) !== null).length });
}
