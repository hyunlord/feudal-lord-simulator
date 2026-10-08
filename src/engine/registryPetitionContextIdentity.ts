import type { Context } from './registryPetitionContextFacts';
export type FixedContext = {
  readonly subjectKey: string;
  readonly partyIds: readonly string[];
  readonly materialBefore: Context;
  readonly triggerEvidence: Context;
};
export function contextRecord(value: unknown): Context | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : undefined;
}
export function readFixedContext(value: Context): FixedContext | null {
  const materialBefore = contextRecord(value.materialBefore);
  const triggerEvidence = contextRecord(value.triggerEvidence);
  if (typeof value.subjectKey !== 'string' || value.subjectKey.length === 0 || !Array.isArray(value.partyIds)
    || value.partyIds.length === 0 || !value.partyIds.every((id: unknown) => typeof id === 'string' && id.length > 0)
    || materialBefore === undefined || triggerEvidence === undefined) return null;
  const partyIds: string[] = value.partyIds.filter((id: unknown): id is string => typeof id === 'string');
  if (new Set(partyIds).size !== partyIds.length) return null;
  return { subjectKey: value.subjectKey, partyIds, materialBefore, triggerEvidence };
}
function field(value: unknown, key: string): unknown { return contextRecord(value)?.[key]; }
function sources(strategy: string, evidence: Context): unknown {
  switch (strategy) {
    case 'grain_haulage': return [evidence.buildingId, evidence.resource, evidence.stuckSinceTick, evidence.carterHouseholdId];
    case 'small_rights': return field(evidence.petition, 'id');
    case 'logs_waiting': case 'market_supply': return evidence.siteIds;
    case 'fields_storage': return [evidence.fieldIds, evidence.demand];
    case 'grain_water': return [evidence.unwateredHouseIds, evidence.demand];
    case 'market_storage': return [evidence.marketId, evidence.fullStorehouseIds, evidence.demand];
    case 'paid_subsidy': return [evidence.receiptId, evidence.subsidyId];
    case 'replacement_trade': return [evidence.closed, evidence.opened];
    case 'new_artisan': return evidence.arrivalRecordId;
    case 'shop_repair': return evidence.houseId;
    case 'unused_subsidy': return evidence.subsidyId;
    case 'high_dues': return [evidence.marketId, evidence.householdId];
    case 'pending_order': return [field(evidence.unpaidExpense, 'tick'), field(evidence.unpaidExpense, 'facility')];
    case 'malt_grain': return [evidence.brewerHouseId, evidence.millerHouseId];
    case 'old_possession': return [evidence.claimId, evidence.basis, evidence.since];
    case 'parallel_accounts': return Array.isArray(evidence.accounts) ? evidence.accounts.map((item: unknown) => [field(item, 'estateId'), field(item, 'tick')]) : undefined;
    case 'ability_loyalty': case 'dispositions': return Array.isArray(evidence.candidates) ? evidence.candidates.map((item: unknown) => field(item, 'personId')) : undefined;
    default: return undefined;
  }
}
/** Only explicit source identities are compared. Resource quantities and current settings are observations. */
export function sameContextSources(strategy: string, current: Context, fixed: FixedContext): boolean {
  const parsed = readFixedContext(current);
  if (parsed === null) return false;
  const oldSources = sources(strategy, fixed.triggerEvidence);
  const newSources = sources(strategy, parsed.triggerEvidence);
  return oldSources !== undefined && newSources !== undefined && JSON.stringify([parsed.subjectKey, parsed.partyIds, newSources])
    === JSON.stringify([fixed.subjectKey, fixed.partyIds, oldSources]);
}
export function fixedSourceIds(fixed: FixedContext | undefined, key: string): readonly string[] | undefined {
  const value = fixed?.triggerEvidence[key];
  return Array.isArray(value) && value.every((id: unknown) => typeof id === 'string') ? value.filter((id: unknown): id is string => typeof id === 'string') : undefined;
}
