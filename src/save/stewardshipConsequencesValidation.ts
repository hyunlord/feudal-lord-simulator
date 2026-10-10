const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

/** Legacy absence stays neutral; retained provenance does not require an unpruned source petition or audit. */
export function stewardshipConsequencesProblem(state: Readonly<Record<string, unknown>>): string | null {
  const own = state.stewardship;
  if (!object(own)) return null;
  const end = typeof state.tick === 'number' ? state.tick : -1;
  if (Array.isArray(own.oversight)) for (const row of own.oversight) {
    if (!object(row) || !Object.hasOwn(row, 'charterResistance')) continue;
    const pressure = row.charterResistance;
    if (!object(pressure) || !text(pressure.petitionId) || !integer(pressure.since, 0, end)
      || !integer(pressure.retryAfter, pressure.since) || !integer(pressure.remainingSeasons, 0, 4))
      return 'stewardship.oversight.charterResistance is invalid';
  }
  if (Array.isArray(own.stewards)) for (const row of own.stewards) {
    if (!object(row)) continue;
    if (Object.hasOwn(row, 'auditTolerance')) {
      const policy = row.auditTolerance;
      if (!object(policy) || !text(policy.auditId) || !integer(policy.since, 0, end)
        || !integer(policy.baselineLoss, 0) || !integer(policy.baselineLoyalty, 0, 100) || !integer(policy.perSeason, 0))
        return 'stewardship.stewards.auditTolerance is invalid';
    }
    if (!Object.hasOwn(row, 'toleratedErrors')) continue;
    if (!Array.isArray(row.toleratedErrors)) return 'stewardship.stewards.toleratedErrors must be an array';
    const ids = new Set<string>();
    for (const pressure of row.toleratedErrors) {
      if (!object(pressure) || !text(pressure.auditId) || ids.has(pressure.auditId)
        || !integer(pressure.unrecovered, 1) || !integer(pressure.perSeason, 1) || !integer(pressure.remainingSeasons, 1, 4))
        return 'stewardship.stewards.toleratedErrors is invalid';
      ids.add(pressure.auditId);
    }
  }
  if (Array.isArray(own.audits)) for (const row of own.audits) {
    if (!object(row)) continue;
    if (Object.hasOwn(row, 'decidedBy') && row.decidedBy !== 'lord' && row.decidedBy !== 'steward')
      return 'stewardship.audits.decidedBy is invalid';
    if (row.decidedBy === 'steward' && (row.status !== 'tolerated' || !text(row.policyAuditId))
      || Object.hasOwn(row, 'policyAuditId') && (row.decidedBy !== 'steward' || !text(row.policyAuditId)))
      return 'stewardship.audits.policyAuditId is invalid';
    if (object(row) && Object.hasOwn(row, 'unrecovered') && !integer(row.unrecovered, 0))
      return 'stewardship.audits.unrecovered must be a nonnegative integer';
  }
  if (Array.isArray(own.summaries)) for (const row of own.summaries) {
    if (!object(row)) continue;
    if (Object.hasOwn(row, 'charterLoss')) {
      const loss = row.charterLoss;
      if (!object(loss) || !text(loss.petitionId) || !integer(loss.amount, 1)) return 'stewardship.summaries.charterLoss is invalid';
    }
    if (Object.hasOwn(row, 'toleratedLosses')) {
      if (!Array.isArray(row.toleratedLosses)) return 'stewardship.summaries.toleratedLosses must be an array';
      const ids = new Set<string>();
      for (const loss of row.toleratedLosses) {
        if (!object(loss) || !text(loss.auditId) || ids.has(loss.auditId) || !integer(loss.amount, 1))
          return 'stewardship.summaries.toleratedLosses is invalid';
        ids.add(loss.auditId);
      }
    }
  }
  return null;
}
