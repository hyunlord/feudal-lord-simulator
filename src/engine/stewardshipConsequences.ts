import { PRESSURE_BALANCE } from '../content/balanceConfig';
import { STEWARDSHIP_CONSEQUENCES as RULE } from '../content/stewardshipConsequencesConfig';
import type { GameState } from './engine.types';
import type { AuditRecord, EstateOversight, EstatePetition, QuarterSummary, StewardRecord } from './stewardship.types';
import { activeAuditTolerance, auditToleranceRequiresDecision } from './auditTolerancePolicy';
import { lordMode } from './townAgency';

/** A dispute occupies the same petition slot; it does not reroll a different demand. */
export function charterPetitionSuppressed(state: GameState, oversight: EstateOversight): boolean {
  const resistance = oversight.charterResistance;
  return lordMode(state) && resistance !== undefined && (resistance.remainingSeasons > 0
    || state.tick < resistance.retryAfter && oversight.merchants <= RULE.charterRecoveryAbove);
}

export function charterRefusal(state: GameState, oversight: EstateOversight, petition: EstatePetition): EstateOversight {
  if (!lordMode(state) || petition.kind !== 'charter_request' || oversight.merchants > -100) return oversight;
  return { ...oversight, charterResistance: { petitionId: petition.id, since: state.tick,
    remainingSeasons: RULE.charterSeasons, retryAfter: state.tick + RULE.charterRetrySeasons * PRESSURE_BALANCE.seasonTicks } };
}

export function tolerateAuditErrors(state: GameState, record: StewardRecord, audit: AuditRecord): StewardRecord {
  const unrecovered = audit.revealedKept + audit.revealedErrors;
  if (!lordMode(state)) return record;
  return { ...record, auditTolerance: { auditId: audit.id, since: state.tick, baselineLoss: unrecovered,
    baselineLoyalty: record.loyalty, perSeason: Math.ceil(unrecovered / RULE.toleranceLossDivisor) } };
}

export function reportOnlyAudit(state: GameState, audit: AuditRecord, record: StewardRecord | undefined): boolean {
  if (!lordMode(state)) return false;
  if (audit.superseded === true || record === undefined || record.status !== 'serving' || record.since > audit.tick
    || state.stewardship?.oversight.find(row => row.estateId === audit.estateId)?.stewardId !== audit.stewardId
    || state.estates?.people.find(row => row.id === audit.stewardId)?.alive === false) return true;
  return !auditToleranceRequiresDecision(state, audit, record)
    && audit.revealedKept === 0 && audit.revealedErrors === 0 && record.loyalty === 100;
}

/** The resistance reduces only the trade share; rent rates and petition prices stay unchanged. */
export function charterSeasonLoss(state: GameState, oversight: EstateOversight, tradeIncome: number, income: number): {
  readonly oversight: EstateOversight; readonly loss: number; readonly evidence?: QuarterSummary['charterLoss'];
} {
  const resistance = oversight.charterResistance;
  if (!lordMode(state) || resistance === undefined || resistance.remainingSeasons <= 0) return { oversight, loss: 0 };
  const loss = Math.min(income, Math.round(tradeIncome * RULE.charterTradeLossPermille / 1000));
  return { oversight: { ...oversight, charterResistance: { ...resistance, remainingSeasons: resistance.remainingSeasons - 1 } }, loss,
    ...(loss > 0 ? { evidence: { petitionId: resistance.petitionId, amount: loss } } : {}) };
}

/** New errors consume available revenue only; already reported historic losses are not deducted again. */
export function toleratedSeasonLoss(state: GameState, record: StewardRecord, available: number): {
  readonly record: StewardRecord; readonly loss: number; readonly evidence: NonNullable<QuarterSummary['toleratedLosses']>;
} {
  if (!lordMode(state)) return { record, loss: 0, evidence: [] };
  let left = available;
  const evidence: { auditId: string; amount: number }[] = [];
  const policy = activeAuditTolerance(state, record);
  if (policy !== undefined) {
    const amount = Math.min(left, policy.perSeason);
    if (amount > 0) evidence.push({ auditId: policy.auditId, amount });
    left -= amount;
  }
  for (const pressure of record.toleratedErrors ?? []) {
    if (pressure.auditId === record.auditTolerance?.auditId || pressure.remainingSeasons <= 0) continue;
    const amount = Math.min(left, pressure.perSeason);
    if (amount > 0) evidence.push({ auditId: pressure.auditId, amount });
    left -= amount;
  }
  const remaining = (record.toleratedErrors ?? []).filter(row => row.remainingSeasons > 1 && row.auditId !== record.auditTolerance?.auditId)
    .map(row => ({ ...row, remainingSeasons: row.remainingSeasons - 1 }));
  const { toleratedErrors: _old, ...rest } = record;
  return { record: remaining.length > 0 ? { ...rest, toleratedErrors: remaining } : rest, loss: available - left, evidence };
}
