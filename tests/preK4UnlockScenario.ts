import { CORE_SCENARIOS } from '../src/content/scenario/coreScenarios';
import { SCENARIOS } from '../src/content/scenario/registry';
import type { GameState } from '../src/engine/engine.types';

/**
 * Natural snapshots captured before B2 were grown under the pre-K4-1 unlock table, where the church
 * unlocked with the stone-town proclamation. Tests that replay such a snapshot to check an unrelated
 * rule (mill replenishment, storage recovery) run it under this scenario so the snapshot keeps the
 * rules it was captured with. The default campaign's own behaviour is covered by the guardrail and
 * tests/scenarioEra.test.ts.
 */
export const PRE_K4_UNLOCK_SCENARIO_ID = 'test:pre_k4_unlocks';

export function underPreK4Unlocks(state: GameState): GameState {
  if (SCENARIOS.get(PRE_K4_UNLOCK_SCENARIO_ID) === undefined) {
    const campaign = CORE_SCENARIOS[0]!;
    SCENARIOS.register({ ...campaign, id: PRE_K4_UNLOCK_SCENARIO_ID, stages: campaign.stages.map(stage =>
      stage.id === 'market_town' ? { ...stage, unlocks: stage.unlocks.filter(kind => kind !== 'church') }
        : stage.id === 'fortified_town' ? { ...stage, unlocks: ['church', ...stage.unlocks] } : stage) });
  }
  return { ...state, scenarioId: PRE_K4_UNLOCK_SCENARIO_ID };
}
