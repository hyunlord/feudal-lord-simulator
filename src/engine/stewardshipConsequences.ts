import { PRESSURE_BALANCE } from '../content/balanceConfig';
import { STEWARDSHIP_CONSEQUENCES as RULE } from '../content/stewardshipConsequencesConfig';
import type { GameState } from './engine.types';
import type { AuditRecord, EstateOversight, EstatePetition, QuarterSummary, StewardRecord } from './stewardship.types';
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
  if (!lordMode(state) || unrecovered <= 0) return record;
  return { ...record, toleratedErrors: [...(record.toleratedErrors ?? []), { auditId: audit.id, unrecovered,
    perSeason: Math.ceil(unrecovered / RULE.toleranceLossDivisor), remainingSeasons: RULE.toleranceSeasons }] };
}

export function reportOnlyAudit(state: GameState, audit: AuditRecord, record: StewardRecord | undefined): boolean {
  return lordMode(state) && audit.revealedKept === 0 && audit.revealedErrors === 0 && record?.loyalty === 100;
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
  if (!lordMode(state) || record.toleratedErrors === undefined) return { record, loss: 0, evidence: [] };
  let left = available;
  const evidence: { auditId: string; amount: number }[] = [];
  for (const pressure of record.toleratedErrors) {
    const amount = Math.min(left, pressure.perSeason);
    if (amount > 0) evidence.push({ auditId: pressure.auditId, amount });
    left -= amount;
  }
  const remaining = record.toleratedErrors.filter(row => row.remainingSeasons > 1)
    .map(row => ({ ...row, remainingSeasons: row.remainingSeasons - 1 }));
  const { toleratedErrors: _old, ...rest } = record;
  return { record: remaining.length > 0 ? { ...rest, toleratedErrors: remaining } : rest, loss: available - left, evidence };
}
