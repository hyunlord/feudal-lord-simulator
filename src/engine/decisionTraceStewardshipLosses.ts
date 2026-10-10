import type { GameState } from './engine.types';
import type { QuarterSummary } from './stewardship.types';
import type { TracedAnswerContribution } from './decisionTrace.types';

function lossOwners(before: GameState, after: GameState, summary: QuarterSummary): readonly string[] {
  const oversight = before.stewardship?.oversight.find(row => row.estateId === summary.estateId);
  const steward = before.stewardship?.stewards.find(row => row.personId === oversight?.stewardId && row.estateId === summary.estateId);
  if (!oversight || !steward) return [];
  const answers = after.trace?.answers?.filter(answer => answer.by === 'lord' && answer.tick < summary.tick) ?? [];
  const owners: string[] = [];
  const unique = (matches: readonly TracedAnswerContribution[]) => {
    if (matches.length === 1 && matches[0]) owners.push(matches[0].id);
  };
  const charter = summary.charterLoss;
  if (charter && charter.amount > 0 && oversight.charterResistance?.petitionId === charter.petitionId
    && oversight.charterResistance.remainingSeasons > 0) {
    const petition = after.stewardship?.petitions.find(row => row.id === charter.petitionId);
    if (petition?.estateId === summary.estateId && petition.kind === 'charter_request' && petition.status === 'refused' && petition.decidedBy === 'lord') {
      unique(answers.filter(answer => answer.targets.includes(`estate_petition:${charter.petitionId}`)
        && (answer.kind === 'registry' || (answer.kind === 'estate_petition'
          && answer.source === `estate_petition:${summary.estateId}:charter_request:refused`))));
    }
  }
  const losses = summary.toleratedLosses ?? [];
  if (losses.reduce((total, loss) => total + loss.amount, 0) > summary.error) return owners;
  for (const loss of losses) {
    const pressure = steward.toleratedErrors?.find(row => row.auditId === loss.auditId);
    const audit = after.stewardship?.audits.find(row => row.id === loss.auditId);
    if (loss.amount <= 0 || !pressure || pressure.remainingSeasons <= 0 || loss.amount > pressure.perSeason
      || audit?.estateId !== summary.estateId || audit.stewardId !== steward.personId || audit.status !== 'tolerated') continue;
    unique(answers.filter(answer => (answer.kind === 'audit' && answer.source === `audit:tolerate:${loss.auditId}`)
      || (answer.kind === 'registry' && answer.targets.includes(`audit:tolerate:${loss.auditId}`))));
  }
  return [...new Set(owners)];
}

/** Existing seasonal accounts gain only the exact answers that caused their realized losses. */
export function linkStewardshipLossReceipts(before: GameState, after: GameState): GameState {
  if (!after.agency || !after.history || !after.trace?.answers || before.stewardship === after.stewardship) return after;
  const fresh = after.stewardship?.summaries.filter(row => !before.stewardship?.summaries.includes(row)) ?? [];
  const known = new Set(before.history?.records.map(row => row.id));
  let changed = false;
  const records = after.history.records.map(record => {
    if (known.has(record.id) || record.template !== 'stewardship.season') return record;
    const candidates = fresh.filter(summary => summary.tick === record.tick && summary.tick === after.tick
      && record.params?.house === (after.estates?.estates.find(row => row.id === summary.estateId)?.name ?? summary.estateId)
      && record.params?.reported === summary.reported && record.params?.mode === summary.mode
      && record.params?.marketLoss === summary.charterLoss?.amount
      && record.params?.toleratedError === (summary.toleratedLosses?.reduce((total, loss) => total + loss.amount, 0) || undefined));
    const summary = candidates.length === 1 ? candidates[0] : undefined;
    if (!summary || after.history?.records.filter(row => !known.has(row.id) && row.template === record.template
      && row.tick === record.tick && JSON.stringify(row.params) === JSON.stringify(record.params)).length !== 1) return record;
    const owners = lossOwners(before, after, summary).filter(id => !record.because?.some(cause => cause.decisionId === id && cause.key === 'decision_effect'));
    if (!owners.length) return record;
    changed = true;
    return { ...record, because: [...(record.because ?? []), ...owners.map(decisionId => ({ decisionId, key: 'decision_effect' as const, part: true as const }))] };
  });
  return changed ? { ...after, history: { ...after.history, records } } : after;
}
