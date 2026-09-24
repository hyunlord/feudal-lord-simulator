// Per-period money record for growth runs (spec M-8, gate ③): what each period posted, by category,
// and the counts the rules charged, so balance values can be compared on one run.
import type { GameState } from '../src/engine/engine.types';
import { LEDGER_PERIOD_TICKS, treasuryBalance, accountBalance } from '../src/ledger/ledger';
import { housingLotCount } from '../src/population/housing';

export interface MoneyPeriodSample {
  readonly tick: number;
  readonly lots: number;
  readonly cash: number;
  readonly arrearsOwed: number;
  readonly unpaidFacilities: number;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly income: number;
  readonly spending: number;
  readonly homesByLevel: Readonly<Record<string, number>>;
  readonly facilities: Readonly<Record<string, number>>;
  readonly era: string;
}

const FACILITY_KINDS = new Set(['well', 'market', 'church', 'mill', 'storehouse']);

export function moneyPeriodSample(state: GameState): MoneyPeriodSample | null {
  if (state.tick <= 0 || state.tick % LEDGER_PERIOD_TICKS !== 0) return null;
  const byCategory: Record<string, number> = {};
  let income = 0;
  let spending = 0;
  for (const entry of state.ledger?.entries ?? []) {
    if (entry.tick !== state.tick || entry.account !== 'cash' || entry.category === 'opening_balance') continue;
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + entry.amount;
    if (entry.amount > 0) income += entry.amount; else spending -= entry.amount;
  }
  const homesByLevel: Record<string, number> = {};
  for (const house of state.houses) if (house.residents > 0) homesByLevel[house.level] = (homesByLevel[house.level] ?? 0) + 1;
  const facilities: Record<string, number> = {};
  for (const building of state.buildings) if (FACILITY_KINDS.has(building.kind)) facilities[building.kind] = (facilities[building.kind] ?? 0) + 1;
  return {
    tick: state.tick, lots: housingLotCount(state), cash: treasuryBalance(state),
    arrearsOwed: state.ledger === undefined ? 0 : accountBalance(state.ledger, 'arrears'),
    unpaidFacilities: state.buildings.filter(building => building.upkeepUnpaid === true).length,
    byCategory, income, spending, homesByLevel, facilities, era: state.era,
  };
}
