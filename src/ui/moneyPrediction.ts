import type { SourceRef } from '../contracts';
import { MONEY_BALANCE } from '../content/balanceConfig';
import { MONEY_RULE_COPY } from '../content/moneyCopy.ko';
import type { GameState } from '../engine/engine.types';
import { stoneWallProjectAvailable } from '../engine/era';
import { treasuryBalance } from '../ledger/ledger';
import type { PredictionLine } from './predictionTypes';

const PROJECT_SOURCE: SourceRef = { type: 'policy', id: 'stone_wall_project' };

/** M-7: what proclaiming the stone-wall project spends, or why the treasury blocks it. */
export function stoneProjectPredictionLines(state: GameState): readonly PredictionLine[] {
  if (state.era !== 'palisade' || !stoneWallProjectAvailable(state)) return [];
  const balance = treasuryBalance(state);
  const cost = MONEY_BALANCE.stoneWallProjectCost;
  return [balance >= cost
    ? { id: 'stone-project-cost', severity: 'info', text: MONEY_RULE_COPY.projectSpend(cost, balance - cost), sources: [PROJECT_SOURCE] }
    : { id: 'stone-project-cost', severity: 'block', text: MONEY_RULE_COPY.projectShort(cost, balance), sources: [PROJECT_SOURCE] }];
}
