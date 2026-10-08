import { stateArchetype } from './archetype';
import type { GameState } from './engine.types';
import { boundId, snapshot, type Context } from './registryPetitionContextFacts';
import { readFixedContext } from './registryPetitionContextIdentity';
import { lordEstatePetitions } from './stewardship';

/** 041 uses the canon's home-woodland branch; no customary right is inferred from trees. */
export function woodlandPetitionContext(state: GameState, bound: Context, fixed?: Context): Context | null {
  const archetype = stateArchetype(state);
  if (state.agency === undefined || archetype?.terrain.kind !== 'woodland' || !state.tiles.some(tile => tile.terrain === 'forest')) return null;
  const petition = lordEstatePetitions(state).find(item => item.id === boundId(bound, 'estatePetition')
    && item.estateId === 'estate-home' && item.kind === 'pannage' && item.deadline >= state.tick);
  if (petition === undefined) return null;
  const context = snapshot(petition.id, [petition.group], {}, { estateId: petition.estateId, archetypeId: archetype.id, branch: 'home_woodland' });
  if (fixed === undefined) return context;
  const pinned = readFixedContext(fixed);
  return pinned !== null && pinned.subjectKey === context.subjectKey && pinned.partyIds.length === 1 && pinned.partyIds[0] === petition.group
    && JSON.stringify(pinned.triggerEvidence) === JSON.stringify(context.triggerEvidence) ? fixed : null;
}
