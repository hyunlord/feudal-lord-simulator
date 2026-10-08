import type { RegistryCandidateGate, RegistryCandidateObservation } from '../src/engine/registryCandidateObservation';

interface CandidateGateTotals {
  readonly entryId: string;
  readonly gate: RegistryCandidateGate;
  readonly count: number;
  readonly first: RegistryCandidateObservation;
  readonly last: RegistryCandidateObservation;
  readonly combinations: number;
  readonly contextFailures: number;
  readonly conditionFailures: number;
  readonly truncatedCount: number;
  readonly missingBindings: Readonly<Record<string, number>>;
  readonly enabledChoiceObservations: number;
  readonly enabledChoicesTotal: number;
}

export class CandidateAuditInputError extends Error {
  constructor() { super('Invalid candidate observation missingBindings diagnostic'); this.name = 'CandidateAuditInputError'; }
}

function bindingCounts(json: string): Readonly<Record<string, number>> {
  const value: unknown = JSON.parse(json);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new CandidateAuditInputError();
  const entries: [string, number][] = [];
  for (const [key, count] of Object.entries(value)) {
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new CandidateAuditInputError();
    entries.push([key, count]);
  }
  return Object.fromEntries(entries);
}

/** Bounded by catalog IDs × gate kinds; only two raw representatives per group survive. */
export function createCandidateAuditCollector() {
  const totals = new Map<string, CandidateGateTotals>();
  let observations = 0;
  return {
    observe(record: RegistryCandidateObservation): void {
      const key = `${record.entryId}:${record.gate}`;
      const old = totals.get(key);
      const missing = new Map(Object.entries(old?.missingBindings ?? {}));
      for (const [name, count] of Object.entries(bindingCounts(record.missingBindings))) missing.set(name, (missing.get(name) ?? 0) + count);
      observations += 1;
      totals.set(key, { entryId: record.entryId, gate: record.gate, count: (old?.count ?? 0) + 1,
        first: old?.first ?? record, last: record,
        combinations: (old?.combinations ?? 0) + record.combinations,
        contextFailures: (old?.contextFailures ?? 0) + record.contextFailures,
        conditionFailures: (old?.conditionFailures ?? 0) + record.conditionFailures,
        truncatedCount: (old?.truncatedCount ?? 0) + Number(record.truncated), missingBindings: Object.fromEntries(missing),
        enabledChoiceObservations: (old?.enabledChoiceObservations ?? 0) + Number(record.enabledChoices !== undefined),
        enabledChoicesTotal: (old?.enabledChoicesTotal ?? 0) + (record.enabledChoices ?? 0) });
    },
    snapshot() {
      return { observations, groups: [...totals.values()].sort((a, b) => a.entryId.localeCompare(b.entryId) || a.gate.localeCompare(b.gate)),
        limits: ['Only actual v4 candidate evaluation gates are observed; outer registry budget and legacy-path skips are not observed.',
          'Counts are evaluation observations, not independent opportunities, offered events, or inferred eligibility.'] };
    },
  };
}
