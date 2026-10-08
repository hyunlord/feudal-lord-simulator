import { parishContext } from './registryParishContext';
import { woodlandPetitionContext } from './registryWoodlandPetitionContext';
import { pasturePetitionContext } from './registryPasturePetitionContext';
import { marketRoadPetitionContext } from './registryMarketRoadPetitionContext';
import { stewardSuccessionContext } from './registryStewardSuccessionContext';
import { PETITION_CONTEXT_STRATEGIES } from '../content/registry/petitionContextConfig';
import { readFixedContext, sameContextSources } from './registryPetitionContextIdentity';
import type { GameState } from './engine.types';
import { estatePetitionContext } from './registryPetitionContextEstates';
import { townPetitionContext } from './registryPetitionContextTown';
export { handlesPetitionContext } from '../content/registry/petitionContextConfig';
/** Read only facts. Unknown or unprovable premises cannot create an occurrence. */
export function petitionContext(state: GameState, entryId: string, bound: Readonly<Record<string, unknown>>, fixed?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | null {
  const strategy = PETITION_CONTEXT_STRATEGIES[entryId];
  if (state.agency === undefined || strategy === undefined) return null;
  if (strategy === 'parish') return parishContext(state, fixed);
  if (strategy === 'home_woodland') return woodlandPetitionContext(state, bound, fixed);
  if (strategy === 'home_pasture') return pasturePetitionContext(state, bound, fixed);
  if (strategy === 'home_market_road') return marketRoadPetitionContext(state, bound, fixed);
  if (strategy === 'steward_succession') return stewardSuccessionContext(state, bound, fixed);
  const pinned = fixed === undefined ? undefined : readFixedContext(fixed);
  if (pinned === null) return null;
  const current = estatePetitionContext(state, strategy, bound, pinned) ?? townPetitionContext(state, strategy, pinned);
  if (current === null || pinned === undefined) return current;
  return sameContextSources(strategy, current, pinned) ? fixed ?? null : null;
}
