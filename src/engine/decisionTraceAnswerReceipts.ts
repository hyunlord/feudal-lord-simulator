import { HOME_ESTATE_ID } from '../content/estateConfig';
import type { GameState } from './engine.types';
import { estatesOf } from './estates';
import type { EstatePetition } from './stewardship.types';
import type { HistoryRecord } from './history.types';
import type { HistoryBecause } from './history.types';
import { exceptionMatch } from './stewardship';
import { largeSumLine, standingSetting } from './decisionLayer';
import { answerContributionsOn } from './decisionTraceAnswers';

/** Attach routing provenance only to an unambiguous, already emitted petition record. */
export function linkRuleAnswerReceipts(before: GameState, after: GameState): GameState {
  if (!after.history || !after.trace || !after.stewardship || after.stewardship.petitions === before.stewardship?.petitions
    || after.history.nextOrdinal === before.history?.nextOrdinal) return after;
  const known = new Set(before.stewardship?.petitions.map(petition => petition.id));
  const priorRecords = new Set(before.history?.records.map(record => record.id));
  const fresh = after.stewardship.petitions.filter(petition => !known.has(petition.id));
  const matches = (petition: EstatePetition, record: HistoryRecord): boolean => {
    if (priorRecords.has(record.id) || record.tick !== after.tick || petition.tick !== after.tick
      || petition.status !== 'open' || record.params?.kind !== petition.kind || record.params?.amount !== petition.amount) return false;
    if (petition.estateId === HOME_ESTATE_ID) return record.template === 'manor.petition';
    const oversight = after.stewardship?.oversight.find(row => row.estateId === petition.estateId);
    if (petition.escalated === 'direct') {
      const house = estatesOf(after).estates.find(estate => estate.id === petition.estateId)?.name ?? petition.estateId;
      return record.template === 'stewardship.brought' && record.params?.house === house
        && record.params?.late === (petition.reachesLord === undefined ? 0 : 1);
    }
    return petition.escalated !== undefined && record.template === 'stewardship.escalated'
      && record.params?.rule === petition.escalated && record.params?.stewardId === oversight?.stewardId;
  };
  const links = new Map<string, { readonly petition: string; readonly estate: string; readonly owners: readonly string[] }>();
  for (const petition of fresh) {
    const home = petition.estateId === HOME_ESTATE_ID;
    const oversight = after.stewardship.oversight.find(row => row.estateId === petition.estateId);
    const direct = !home && oversight?.mode === 'direct' && petition.escalated === 'direct';
    const matched = exceptionMatch(after.stewardship.rules, petition);
    const ruleContributed = home
      ? after.stewardship.rules.recurring === true && standingSetting(after, petition.kind) !== 'lord' && petition.amount < largeSumLine(after)
      : oversight?.mode !== 'direct' && matched !== null && petition.escalated === matched;
    if (!direct && !ruleContributed) continue;
    const field = home ? 'recurring' : matched === 'amount' ? 'amountAtLeast' : matched;
    const target = direct ? `oversight_mode:${petition.estateId}` : `rules:${field}`;
    const actualOwners = answerContributionsOn(after.trace, target, after.tick).filter(answer => answer.tick < after.tick);
    if (actualOwners.length === 0) continue;
    const records = after.history.records.filter(record => matches(petition, record));
    if (records.length !== 1) continue;
    const record = records[0];
    if (!record || fresh.filter(other => matches(other, record)).length !== 1) continue;
    links.set(record.id, { petition: petition.id, estate: petition.estateId, owners: actualOwners.map(answer => answer.id) });
  }
  if (links.size === 0) return after;
  return { ...after, history: { ...after.history, records: after.history.records.map(record => {
    const binding = links.get(record.id);
    if (!binding) return record;
    const because: readonly HistoryBecause[] = binding.owners.filter(id => !record.because?.some(cause => cause.decisionId === id && cause.key === 'petition_routed'))
      .map(id => ({ decisionId: id, key: 'petition_routed', part: true }));
    return { ...record, params: { ...record.params, tracePetition: binding.petition, traceEstate: binding.estate }, because: [...(record.because ?? []), ...because] };
  }) } };
}

/** A command's actual domain records already exist before its answer card; attach, never invent, their provenance. */
export function linkImmediateAnswerReceipts(before: GameState, after: GameState, answerId: string): GameState {
  if (!after.history) return after;
  const prior = new Set(before.history?.records.map(record => record.id));
  const domain = /^(estate\.(suit_|possession_)|negotiation\.|stewardship\.(rules|oversight|audit_mode|audit_answered|lord_decided)$|manor\.petition_answered$)/;
  let changed = false;
  const records = after.history.records.map(record => {
    if (prior.has(record.id) || record.kind === 'decision' || !domain.test(record.template)) return record;
    if (record.because?.some(cause => cause.decisionId === answerId)) return record;
    changed = true;
    const cause: HistoryBecause = { decisionId: answerId, key: 'decision_effect', part: true };
    return { ...record, because: [...(record.because ?? []), cause] };
  });
  return changed ? { ...after, history: { ...after.history, records } } : after;
}
