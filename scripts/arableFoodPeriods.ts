// C1c-2 gate ③ record: one row per 2,400-tick window of the food flow, the expected harvest and the field size.
import { foodEfficiencyMetrics } from '../src/engine/autoplayFoodEfficiency';
import { annualWheatNeed } from '../src/engine/autoplayArable';
import type { GameState } from '../src/engine/engine.types';
import { housingLotCount } from '../src/population/housing';
import { expectedAnnualWheat } from '../src/zones/arableOutlook';

export function foodPeriodSample(state: GameState, stableSince: number | null): Record<string, number | null> {
  const window = foodEfficiencyMetrics(state);
  const count = (kind: string) => state.buildings.filter(building => building.kind === kind).length;
  return {
    tick: state.tick, stableSince, lots: housingLotCount(state),
    breadProduced: window.breadProduced, requestedBread: window.requestedBread, consumedBread: window.consumedBread,
    wheatProduced: window.wheatProduced, wheatConsumed: window.wheatConsumed,
    rawStarvedTicks: window.rawStarvedTicks, eligibleMillTicks: window.eligibleMillTicks,
    expectedAnnualWheat: expectedAnnualWheat(state), annualWheatNeed: annualWheatNeed(state),
    arableCells: (state.zones ?? []).filter(zone => zone.kind === 'arable').reduce((sum, zone) => sum + zone.membership.length, 0),
    farmsteads: count('farmstead'), mills: count('mill'), granaries: count('granary'),
    storedWheat: state.buildings.reduce((sum, building) => sum + (building.inventory.wheat ?? 0), 0),
    lostWheat: (state.arableFields ?? []).reduce((sum, field) => sum + field.lostWheat, 0),
  };
}
