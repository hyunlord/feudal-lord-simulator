import type { GameState } from './engine.types';
import { boundId, codepoint, snapshot, type Context } from './registryPetitionContextFacts';
import { readFixedContext } from './registryPetitionContextIdentity';
import { lordEstatePetitions } from './stewardship';
import { zonesOf } from '../zones/zoneEdits';

/** The existing petition supplies the dispute; pasture cells supply geometry, never customary title. */
export function pasturePetitionContext(state: GameState, bound: Context, fixed?: Context): Context | null {
  const parties = ['commons', 'merchant_house_2'];
  if (state.agency === undefined || parties.some(id => !state.factions?.factions.some(faction => faction.id === id))) return null;
  const petition = lordEstatePetitions(state).find(item => item.id === boundId(bound, 'estatePetition')
    && item.estateId === 'estate-home' && item.kind === 'common_pasture' && item.deadline >= state.tick);
  if (petition === undefined) return null;
  const pinned = fixed === undefined ? undefined : readFixedContext(fixed);
  if (pinned === null) return null;
  const zones = zonesOf(state).filter(zone => zone.kind === 'pasture'
    && (pinned === undefined || zone.id === pinned.triggerEvidence.zoneId)).sort((a, b) => codepoint(a.id, b.id));
  for (const zone of zones) {
    if (zone.membership.length === 0 || !zone.membership.every((cell, index) => Number.isSafeInteger(cell)
      && cell >= 0 && cell < state.width * state.height && state.tiles[cell] !== undefined
      && (index === 0 || cell > (zone.membership[index - 1] ?? cell)))) continue;
    const context = snapshot(petition.id, parties, {}, { estateId: petition.estateId, group: petition.group,
      zoneId: zone.id, width: state.width, height: state.height, membership: [...zone.membership] });
    if (pinned === undefined) return context;
    return pinned.subjectKey === petition.id && JSON.stringify(pinned.partyIds) === JSON.stringify(parties)
      && JSON.stringify(pinned.triggerEvidence) === JSON.stringify(context.triggerEvidence) ? fixed ?? null : null;
  }
  return null;
}
