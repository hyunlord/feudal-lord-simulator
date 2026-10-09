import { HOME_ESTATE_ID } from '../content/estateConfig';
import type { GameState } from './engine.types';
import type { HistoryBecause } from './history.types';
import { exceptionMatch } from './stewardship';
import { largeSumLine, standingSetting } from './decisionLayer';
import { answerContributionsOn } from './decisionTraceAnswers';

/** Attach routing provenance only to an unambiguous, already emitted petition record. */
export function linkRuleAnswerReceipts(before: GameState, after: GameState): GameState {
  if (!after.history || !after.trace || !after.stewardship || after.stewardship.petitions === before.stewardship?.petitions
    || after.history.nextOrdinal === before.history?.nextOrdinal) return after;
  const owners = answerContributionsOn(after.trace, 'rules', after.tick).filter(answer => answer.tick < after.tick);
  if (owners.length === 0) return after;
  const known = new Set(before.stewardship?.petitions.map(petition => petition.id));
  const priorRecords = new Set(before.history?.records.map(record => record.id));
  const links = new Map<string, { readonly petition: string; readonly estate: string; readonly owners: readonly string[] }>();
  for (const petition of after.stewardship.petitions) {
    if (known.has(petition.id)) continue;
    const home = petition.estateId === HOME_ESTATE_ID;
    const oversight = after.stewardship.oversight.find(row => row.estateId === petition.estateId);
    const matched = exceptionMatch(after.stewardship.rules, petition);
    const ruleContributed = home
      ? after.stewardship.rules.recurring === true && standingSetting(after, petition.kind) !== 'lord' && petition.amount < largeSumLine(after)
      : oversight?.mode !== 'direct' && matched !== null && petition.escalated === matched;
    if (!ruleContributed) continue;
    const field = home ? 'recurring' : matched === 'amount' ? 'amountAtLeast' : matched;
    const actualOwners = answerContributionsOn(after.trace, `rules:${field}`, after.tick).filter(answer => answer.tick < after.tick);
    if (actualOwners.length === 0) continue;
    const template = home ? 'manor.petition' : 'stewardship.escalated';
    const records = after.history.records.filter(record => !priorRecords.has(record.id) && record.template === template
      && record.params?.kind === petition.kind && record.params?.amount === petition.amount
      && (home || record.params?.stewardId === oversight?.stewardId));
    if (records.length !== 1) continue;
    const record = records[0];
    if (record) links.set(record.id, { petition: petition.id, estate: petition.estateId, owners: actualOwners.map(answer => answer.id) });
  }
  if (links.size === 0) return after;
  return { ...after, history: { ...after.history, records: after.history.records.map(record => {
    const binding = links.get(record.id);
    if (!binding) return record;
    const because: readonly HistoryBecause[] = binding.owners.map(id => ({ decisionId: id, key: 'petition_routed', part: true }));
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
