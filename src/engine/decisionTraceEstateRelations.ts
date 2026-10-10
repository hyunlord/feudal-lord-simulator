import { PRESSURE_BALANCE } from '../content/balanceConfig';
import { AUDIT_ANSWER_TICKS, MICHAELMAS_IN_YEAR } from '../content/stewardshipConfig';
import { HOME_ESTATE_ID } from '../content/estateConfig';
import type { GameState } from './engine.types';
import type { EstateRelationEvidence } from './decisionTrace.types';
import { estatesOf } from './estates';
import { estatePetitionEffect, heldOffMapEstates } from './stewardship';
import type { HistoryRecord } from './history.types';
import type { QuarterSummary } from './stewardship.types';

const dimensions = ['tenants', 'merchants'] as const;
const season = PRESSURE_BALANCE.seasonTicks;
const interior = (value: number) => value > -100 && value < 100;
const oversight = (state: GameState, id: string) => state.stewardship?.oversight.find(row => row.estateId === id);
type Action = { readonly type: string } & Readonly<Record<string, unknown>>;

function commandEvidence(before: GameState, after: GameState, action: Action): readonly EstateRelationEvidence[] {
  if (action.type !== 'answer_estate_petition' || typeof action.petitionId !== 'string' || typeof action.grant !== 'boolean') return [];
  const petition = before.stewardship?.petitions.find(row => row.id === action.petitionId);
  const settled = after.stewardship?.petitions.find(row => row.id === action.petitionId);
  if (!petition || petition.estateId === HOME_ESTATE_ID || petition.status !== 'open' || settled?.decidedBy !== 'lord'
    || settled.status !== (action.grant ? 'granted' : 'refused')) return [];
  const effect = estatePetitionEffect(before, petition.id, action.grant);
  const old = oversight(before, petition.estateId), current = oversight(after, petition.estateId);
  if (!effect || !old || !current) return [];
  return dimensions.filter(dimension => effect[dimension] !== 0).map(dimension => {
    const actual = current[dimension] - old[dimension], intended = effect[dimension];
    return { estateId: petition.estateId, dimension, before: old[dimension], after: current[dimension], intended, actual,
      expected: current[dimension], firstSeasonTick: (Math.floor(after.tick / season) + 1) * season,
      status: actual !== 0 && actual === intended && interior(current[dimension]) ? 'pending' : 'invalidated' };
  });
}

/** Only known real commands extend an unbroken dimension chain; unknown writers invalidate it. */
export function traceEstateRelationCommand(before: GameState, after: GameState, action: Action): GameState {
  if (before.stewardship === after.stewardship || !after.trace?.answers) return after;
  const latest = after.trace.answers.at(-1);
  const own = latest && latest.id !== before.trace?.answers?.at(-1)?.id ? latest : undefined;
  const evidence = own ? commandEvidence(before, after, action) : [];
  const conflicts = new Set<string>();
  let changed = false;
  const answers = after.trace.answers.map(answer => {
    if (!answer.estateRelationEvidence) return answer;
    const rows = answer.estateRelationEvidence.map(row => {
      if (row.status !== 'pending') return row;
      const old = oversight(before, row.estateId), current = oversight(after, row.estateId);
      const step = evidence.find(item => item.estateId === row.estateId && item.dimension === row.dimension);
      const opposite = step && Math.sign(step.actual) !== Math.sign(row.actual);
      if (opposite) conflicts.add(`${row.estateId}:${row.dimension}`);
      const valid = old && current && old[row.dimension] === row.expected && after.tick < row.firstSeasonTick
        && (old === current || (step ? step.status === 'pending' && !opposite : evidence.length > 0 && old[row.dimension] === current[row.dimension]
          && old.stewardId === current.stewardId && old.mode === current.mode && old.auditMode === current.auditMode));
      changed = true;
      return { ...row, expected: current?.[row.dimension] ?? row.expected, status: valid ? 'pending' as const : 'invalidated' as const };
    });
    return { ...answer, estateRelationEvidence: rows };
  });
  if (own && evidence.length) {
    const index = answers.length - 1;
    answers[index] = { ...own, estateRelationEvidence: evidence.map(row => conflicts.has(`${row.estateId}:${row.dimension}`)
      ? { ...row, status: 'invalidated' as const } : row) };
    changed = true;
  }
  return changed ? { ...after, trace: { ...after.trace, answers } } : after;
}

function matches(state: GameState, summary: QuarterSummary, record: HistoryRecord): boolean {
  const house = estatesOf(state).estates.find(row => row.id === summary.estateId)?.name ?? summary.estateId;
  return record.template === 'stewardship.season' && record.tick === summary.tick && record.params?.house === house
    && record.params.reported === summary.reported && record.params.mode === summary.mode
    && record.params.overloaded === (summary.overloaded ? 1 : 0);
}

/** Michaelmas resets audited counters and reconstructs oversight without changing its relationship values. */
function auditOnlyContinuity(before: GameState, after: GameState, estateId: string): boolean {
  const previous = before.stewardship, next = after.stewardship;
  if (!previous || !next || after.tick % (4 * season) !== MICHAELMAS_IN_YEAR
    || previous.rules !== next.rules || previous.standing !== next.standing || previous.nextPetition !== next.nextPetition
    || previous.petitions !== next.petitions || previous.summaries !== next.summaries
    || !previous.audits.every((known, index) => next.audits[index] === known)) return false;
  const held = new Set(heldOffMapEstates(before).map(estate => estate.id));
  const audited = previous.oversight.filter(row => held.has(row.estateId));
  const audits = next.audits.slice(previous.audits.length);
  if (!audited.some(row => row.estateId === estateId) || audits.length !== audited.length
    || next.nextAudit !== previous.nextAudit + audits.length
    || next.visitTick !== (audits.some(audit => audit.mode === 'visit') ? after.tick : previous.visitTick)) return false;
  return audited.every((old, index) => {
    const current = oversight(after, old.estateId), audit = audits[index];
    const prior = previous.stewards.find(row => row.personId === old.stewardId && row.estateId === old.estateId);
    const steward = next.stewards.find(row => row.personId === old.stewardId && row.estateId === old.estateId);
    return current && audit && prior && steward && old.stewardId === current.stewardId && old.mode === current.mode
      && old.auditMode === current.auditMode && old.since === current.since
      && old.tenants === current.tenants && old.merchants === current.merchants
      && audit.id === `audit-${previous.nextAudit + index}` && audit.estateId === old.estateId && audit.tick === after.tick
      && audit.stewardId === old.stewardId && audit.mode === old.auditMode && audit.deadline === after.tick + AUDIT_ANSWER_TICKS
      && audit.revealedErrors === prior.errors && [0, prior.kept].includes(audit.revealedKept)
      && audit.hidden === prior.kept - audit.revealedKept && current.undetected === old.undetected + audit.hidden
      && audit.status === (audit.revealedKept + prior.errors > 0 ? 'pending' : 'clean')
      && steward.kept === 0 && steward.errors === 0 && prior.ability === steward.ability && prior.loyalty === steward.loyalty
      && prior.disposition === steward.disposition && prior.connection === steward.connection
      && prior.since === steward.since && prior.status === steward.status;
  });
}

/** Observe the first actual season, never allocate a replacement or infer missing legacy proof. */
export function linkEstateRelationSeason(before: GameState, after: GameState): GameState {
  if (before.stewardship === after.stewardship || !after.trace?.answers) return after;
  const fresh = after.stewardship?.summaries.filter(row => !before.stewardship?.summaries.includes(row)) ?? [];
  const knownRecords = new Set(before.history?.records.map(row => row.id));
  const records = after.history?.records.filter(row => !knownRecords.has(row.id)) ?? [];
  const links = new Map<string, { readonly id: string; readonly proof: EstateRelationEvidence }[]>();
  let changed = false;
  const answers = after.trace.answers.map(answer => {
    if (!answer.estateRelationEvidence) return answer;
    const evidence = answer.estateRelationEvidence.map(row => {
      if (row.status !== 'pending') return row;
      const old = oversight(before, row.estateId), current = oversight(after, row.estateId);
      const summaries = fresh.filter(summary => summary.estateId === row.estateId);
      if (!old || !current || old[row.dimension] !== row.expected || after.tick > row.firstSeasonTick) {
        changed = true;
        return { ...row, status: 'invalidated' as const };
      }
      if (!summaries.length) {
        if (after.tick >= row.firstSeasonTick || (old !== current && !auditOnlyContinuity(before, after, row.estateId))) {
          changed = true;
          return { ...row, status: 'invalidated' as const };
        }
        return row;
      }
      changed = true;
      const summary = summaries[0];
      // Seasonal relation increments are independent and clamped once; retain only an unclamped marginal delta.
      const valid = summaries.length === 1 && summary && summary.tick === after.tick && after.tick === row.firstSeasonTick
        && old.stewardId === current.stewardId && old.mode === current.mode
        && answer.tick < after.tick && summary[row.dimension] === current[row.dimension] && interior(current[row.dimension])
        && interior(current[row.dimension] - row.actual);
      const candidates = valid ? records.filter(record => matches(after, summary, record)) : [];
      const record = candidates[0];
      const unique = record && candidates.length === 1 && fresh.filter(item => matches(after, item, record)).length === 1;
      if (unique) links.set(record.id, [...(links.get(record.id) ?? []), { id: answer.id, proof: row }]);
      return { ...row, expected: current[row.dimension], status: unique ? 'consumed' as const : 'invalidated' as const };
    });
    return { ...answer, estateRelationEvidence: evidence };
  });
  if (!changed) return after;
  const trace = { ...after.trace, answers };
  if (!after.history || !links.size) return { ...after, trace };
  return { ...after, trace, history: { ...after.history, records: after.history.records.map(record => {
    const causes = links.get(record.id);
    if (!causes?.length) return record;
    const first = causes[0];
    if (!first) return record;
    const current = oversight(after, first.proof.estateId);
    if (!current) return record;
    const params = { ...record.params, traceEstate: first.proof.estateId,
      traceRelationTenants: current.tenants, traceRelationMerchants: current.merchants,
      traceTenantsContribution: causes.filter(row => row.proof.dimension === 'tenants').reduce((sum, row) => sum + row.proof.actual, 0),
      traceMerchantsContribution: causes.filter(row => row.proof.dimension === 'merchants').reduce((sum, row) => sum + row.proof.actual, 0) };
    const ids = [...new Set(causes.map(row => row.id))];
    return { ...record, params, because: [...(record.because ?? []), ...ids.filter(id => !record.because?.some(row => row.decisionId === id && row.key === 'estate_mood'))
      .map(decisionId => ({ decisionId, key: 'estate_mood' as const, part: true as const }))] };
  }) } };
}
