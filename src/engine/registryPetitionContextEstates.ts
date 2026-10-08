import { contextRecord, type FixedContext } from './registryPetitionContextIdentity';
import { stateCalendar } from './scenarioState';
import type { GameState } from './engine.types';
import { estatesOf, LORD } from './estates';
import { heldOffMapEstates, stewardshipOf } from './stewardship';
import { boundId, codepoint, snapshot, type Context } from './registryPetitionContextFacts';
export function estatePetitionContext(state: GameState, strategy: string, bound: Context, fixed?: FixedContext): Context | null {
  const stewardship = stewardshipOf(state);
  const estates = estatesOf(state);
  const held = heldOffMapEstates(state);
  const estate = held.find(item => item.id === boundId(bound, 'estate'));
  const alive = (id: string) => estates.people.some(person => person.id === id && person.alive && person.leftYear === undefined && stateCalendar(state).year - person.birthYear >= 16);
  const candidates = stewardship.stewards.filter(person => person.estateId === estate?.id
    && (person.status === 'candidate' || person.status === 'serving') && alive(person.personId));
  const current = candidates.find(person => person.personId === boundId(bound, 'currentSteward', 'personId'));
  if (strategy === 'small_rights') {
    const rules = stewardship.rules;
    if (rules.rights || rules.amountAtLeast === null) return null;
    const petition = [...stewardship.petitions].sort((a, b) => codepoint(a.id, b.id)).find(item => (fixed === undefined || item.id === contextRecord(fixed.triggerEvidence.petition)?.id) && item.rights && !item.marriage
      && item.amount < (rules.amountAtLeast ?? 0) && item.decidedBy === 'steward' && (item.status === 'granted' || item.status === 'refused')
      && held.some(owned => owned.id === item.estateId) && (estate === undefined || item.estateId === estate.id));
    if (petition === undefined) return null;
    const oversight = stewardship.oversight.find(item => item.estateId === petition.estateId && item.mode === 'steward');
    const steward = stewardship.stewards.find(item => item.personId === oversight?.stewardId && item.status === 'serving' && alive(item.personId));
    if (steward === undefined) return null;
    return snapshot(petition.estateId, [steward.personId], { rules: { ...rules } }, { petition: { ...petition } });
  }
  if (strategy === 'old_possession') {
    const suit = estates.suits.find(item => item.id === boundId(bound, 'suit') && item.plaintiff === LORD && ['filed', 'evidence'].includes(item.stage));
    const claim = estates.claims.find(item => item.id === suit?.claimId && item.id === boundId(bound, 'claim') && item.claimant === LORD && item.basis === 'old_possession');
    const representative = [...(state.persons?.people ?? [])].sort((a, b) => codepoint(a.id, b.id))
      .find(person => person.alive && person.leftYear === undefined && (fixed === undefined || fixed.partyIds.includes(person.id)) && person.householdId === 'manor'
        && person.role === 'steward' && stateCalendar(state).year - person.birthYear >= 16);
    if (suit === undefined || claim === undefined || representative === undefined) return null;
    return snapshot(suit.id, [representative.id], { evidence: claim.evidence.map(item => ({ ...item })) }, { claimId: claim.id, basis: claim.basis, since: claim.since });
  }
  if (estate === undefined || current === undefined) return null;
  const oversight = stewardship.oversight.find(item => item.estateId === estate.id && item.stewardId === current.personId);
  if (oversight === undefined) return null;
  if (strategy === 'ability_loyalty' || strategy === 'dispositions') {
    const firstKey = strategy === 'ability_loyalty' ? 'able' : 'merchant';
    const secondKey = strategy === 'ability_loyalty' ? 'loyal' : 'peasant';
    const first = candidates.find(item => item.personId === boundId(bound, firstKey, 'personId'));
    const second = candidates.find(item => item.personId === boundId(bound, secondKey, 'personId'));
    if (first === undefined || second === undefined || first.personId === second.personId) return null;
    if (strategy === 'ability_loyalty' && !(first.ability > second.ability && second.loyalty > first.loyalty)) return null;
    if (strategy === 'dispositions' && !(first.disposition === 'merchant' && second.disposition === 'peasant')) return null;
    return snapshot(estate.id, [current.personId, first.personId, second.personId], { mode: oversight.mode, stewardId: oversight.stewardId }, {
      candidates: [first, second].map(item => ({ personId: item.personId, ability: item.ability, loyalty: item.loyalty, disposition: item.disposition })),
    });
  }
  if (strategy === 'parallel_accounts') {
    const other = held.find(item => item.id === boundId(bound, 'estateB') && item.id !== estate.id);
    const otherOversight = stewardship.oversight.find(item => item.estateId === other?.id);
    if (other === undefined || otherOversight === undefined || !alive(otherOversight.stewardId)) return null;
    const pinnedAccounts = Array.isArray(fixed?.triggerEvidence.accounts) ? fixed.triggerEvidence.accounts : [];
    const accountMatches = (estateId: string, tick: number) => fixed === undefined || pinnedAccounts.some((value: unknown) => {
      const account = contextRecord(value); return account?.estateId === estateId && account.tick === tick;
    });
    const first = [...stewardship.summaries].sort((a, b) => b.tick - a.tick || codepoint(a.estateId, b.estateId)).find(item => item.estateId === estate.id && accountMatches(item.estateId, item.tick));
    const second = [...stewardship.summaries].sort((a, b) => b.tick - a.tick || codepoint(a.estateId, b.estateId)).find(item => item.estateId === other.id && accountMatches(item.estateId, item.tick));
    if (first === undefined || second === undefined || first.tick !== second.tick) return null;
    return snapshot([estate.id, other.id].sort(codepoint).join(':'), [current.personId, otherOversight.stewardId], {
      oversight: [oversight, otherOversight].map(item => ({ estateId: item.estateId, mode: item.mode, auditMode: item.auditMode })),
    }, { accounts: [first, second].map(item => ({ estateId: item.estateId, tick: item.tick, reported: item.reported })) });
  }
  return null;
}
