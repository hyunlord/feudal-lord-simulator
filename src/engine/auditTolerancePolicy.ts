import { STEWARDSHIP_CONSEQUENCES as RULE } from '../content/stewardshipConsequencesConfig';
import type { GameState } from './engine.types';
import type { AuditRecord, AuditTolerance, StewardRecord } from './stewardship.types';
import { lordMode } from './townAgency';

export function auditTolerancePolicyKey(record: Pick<StewardRecord, 'estateId' | 'personId'>): string {
  return `audit:${record.estateId}:${record.personId}`;
}

export function activeAuditTolerance(state: GameState, record: StewardRecord): AuditTolerance | undefined {
  const policy = record.auditTolerance;
  if (!lordMode(state) || policy === undefined || record.status !== 'serving' || record.since > policy.since
    || state.stewardship?.oversight.find(row => row.estateId === record.estateId)?.stewardId !== record.personId
    || state.estates?.people.find(row => row.id === record.personId)?.alive === false
    || state.stewardship?.standing?.[auditTolerancePolicyKey(record)] !== 'lenient') return undefined;
  return policy;
}

/** A changed receiver is reviewed once; unrelated estates without a tolerance history keep their original audit rules. */
export function auditToleranceRequiresDecision(state: GameState, audit: AuditRecord, record: StewardRecord): boolean {
  if (!lordMode(state)) return false;
  const policy = activeAuditTolerance(state, record);
  if (policy !== undefined) return audit.revealedKept + audit.revealedErrors > policy.baselineLoss * RULE.toleranceEscalationMultiplier
    || record.loyalty < policy.baselineLoyalty;
  if (record.auditTolerance !== undefined) return true;
  const previousPolicy = state.stewardship?.stewards.some(row => row.estateId === record.estateId && row.auditTolerance !== undefined);
  return previousPolicy === true && !state.stewardship?.audits.some(row => row.stewardId === record.personId && row.tick >= record.since
    && row.decidedBy === 'lord');
}
