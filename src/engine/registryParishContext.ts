import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import type { GameState } from './engine.types';
import { codepoint, livingResidents, snapshot, type Context } from './registryPetitionContextFacts';
import { readFixedContext } from './registryPetitionContextIdentity';
import { stateCalendar } from './scenarioState';

export function parishContext(state: GameState, fixed?: Context): Context | null {
  if (state.agency === undefined) return null;
  const pinned = fixed === undefined ? undefined : readFixedContext(fixed);
  if (pinned === null || (pinned !== undefined && (pinned.partyIds.length !== 1
    || typeof pinned.triggerEvidence.churchId !== 'string' || typeof pinned.triggerEvidence.householdId !== 'string'
    || !['stability', 'growth', 'revenue', 'defence'].some(policy => policy === pinned.materialBefore.policy)))) return null;
  const year = stateCalendar(state).year;
  const heads = livingResidents(state).filter(person => person.role === 'head' && person.householdId !== 'manor'
    && year - person.birthYear >= 18 && state.houses.some(home => home.buildingId === person.householdId && home.burntTick === undefined)
    && (pinned === undefined || pinned.partyIds[0] === person.id));
  const churches = state.buildings.filter(building => building.kind === 'church'
    && (pinned === undefined || pinned.triggerEvidence.churchId === building.id)).sort((a, b) => codepoint(a.id, b.id));
  for (const head of heads) {
    const home = state.buildings.find(building => building.id === head.householdId && building.kind === 'house');
    if (home === undefined || (pinned !== undefined && pinned.triggerEvidence.householdId !== home.id)) continue;
    const church = churches.find(building => buildingFootprintDistance(home, building) <= BUILDING_CONFIG_BY_KIND.church.serviceRadius);
    if (church === undefined) continue;
    const subjectKey = `parish:${church.id}:${home.id}`;
    if (pinned !== undefined && pinned.subjectKey !== subjectKey) return null;
    return fixed ?? snapshot(subjectKey, [head.id], { policy: state.agency.policy },
      { churchId: church.id, householdId: home.id, distance: buildingFootprintDistance(home, church),
        serviceRadius: BUILDING_CONFIG_BY_KIND.church.serviceRadius });
  }
  return null;
}
