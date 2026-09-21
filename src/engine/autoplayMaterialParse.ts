import type { AutoplayMaterialRecovery, MaterialCycle, MaterialOpportunity, MaterialScore } from './autoplayMaterialTypes';
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function integer(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function text(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
function cycle(value: unknown): MaterialCycle | undefined {
  if (!object(value) || !integer(value.startedTick) || !text(value.sourceId) || !text(value.fetchWalkerId)
    || !text(value.rawPath) || !integer(value.rawEdges) || !integer(value.roadRevision)
    || !integer(value.rawArrived) || !integer(value.produced) || !integer(value.wallDelivered)
    || !integer(value.workingTicks) || !integer(value.haulNoInputTicks)
    || value.outputWalkerId !== undefined && !text(value.outputWalkerId)
    || value.deliveredSiteId !== undefined && !text(value.deliveredSiteId)
    || value.outputEdges !== undefined && !integer(value.outputEdges)
    || value.returnedTick !== undefined && (!integer(value.returnedTick) || value.returnedTick < value.startedTick)) return undefined;
  return { startedTick: value.startedTick, sourceId: value.sourceId, fetchWalkerId: value.fetchWalkerId,
    rawPath: value.rawPath, rawEdges: value.rawEdges, roadRevision: value.roadRevision,
    rawArrived: value.rawArrived, produced: value.produced, wallDelivered: value.wallDelivered,
    workingTicks: value.workingTicks, haulNoInputTicks: value.haulNoInputTicks,
    ...(value.outputWalkerId === undefined ? {} : { outputWalkerId: value.outputWalkerId }),
    ...(value.deliveredSiteId === undefined ? {} : { deliveredSiteId: value.deliveredSiteId }),
    ...(value.outputEdges === undefined ? {} : { outputEdges: value.outputEdges }),
    ...(value.returnedTick === undefined ? {} : { returnedTick: value.returnedTick }) };
}
function score(value: unknown): MaterialScore | undefined {
  if (!object(value) || !integer(value.score) || !integer(value.incumbentScore) || !integer(value.activeEdges)
    || !integer(value.incumbentActiveEdges) || !text(value.sourceId) || !integer(value.rawEdges) || !integer(value.admittedRaw)) return undefined;
  return { score: value.score, incumbentScore: value.incumbentScore, activeEdges: value.activeEdges,
    incumbentActiveEdges: value.incumbentActiveEdges, sourceId: value.sourceId, rawEdges: value.rawEdges, admittedRaw: value.admittedRaw };
}
function opportunity(value: unknown): MaterialOpportunity | undefined {
  if (!object(value) || !text(value.sourceId) || !text(value.activeSiteId) || !integer(value.admittedRaw)
    || !integer(value.rawLegTicks) || !integer(value.outputLegTicks) || !integer(value.workTicks)
    || !integer(value.alignmentTicks) || !integer(value.opportunityUntilTick)) return undefined;
  return { sourceId: value.sourceId, activeSiteId: value.activeSiteId, admittedRaw: value.admittedRaw,
    rawLegTicks: value.rawLegTicks, outputLegTicks: value.outputLegTicks, workTicks: value.workTicks,
    alignmentTicks: value.alignmentTicks, opportunityUntilTick: value.opportunityUntilTick };
}
/** Narrow imported-state boundary: invalid optional detail never turns a recognizable spent latch into permission. */
export function parseMaterialRecovery(value: unknown, tick: number): AutoplayMaterialRecovery | undefined {
  if (!object(value) || !text(value.wallId) || !integer(value.epoch)) return undefined;
  const key = { version: 1 as const, wallId: value.wallId, epoch: value.epoch };
  if (value.version === 1 && value.status === 'observing' && !text(value.attemptSiteId) && text(value.incumbentId)) {
    const current = cycle(value.cycle), completed = cycle(value.completedCycle);
    return { ...key, status: 'observing', incumbentId: value.incumbentId,
      ...(current === undefined ? {} : { cycle: current }),
      ...(completed?.returnedTick === undefined || completed.outputWalkerId === undefined || completed.deliveredSiteId === undefined
        || completed.outputEdges === undefined || completed.returnedTick > tick ? {} : { completedCycle: completed }) };
  }
  if (!text(value.attemptSiteId)) return undefined;
  const reasons = object(value.deterioration) ? value.deterioration : {};
  const counters = { ...(Object.values(reasons).some(value => value === true) ? { deterioration: {
    ...(reasons.understaffed === true ? { understaffed: true as const } : {}),
    ...(reasons.routeUnavailable === true ? { routeUnavailable: true as const } : {}),
    ...(reasons.cancelledTransport === true ? { cancelledTransport: true as const } : {}),
  } } : {}), rawArrived: integer(value.rawArrived) ? value.rawArrived : 0,
    produced: integer(value.produced) ? value.produced : 0, wallDelivered: integer(value.wallDelivered) ? value.wallDelivered : 0 };
  const fallback: AutoplayMaterialRecovery = { ...key, ...counters, status: 'terminal', attemptSiteId: value.attemptSiteId,
    outcome: 'unobservable_at_completion', terminationTick: tick };
  if (value.version !== 1) return fallback;
  switch (value.status) {
    case 'terminal': {
      const outcome = value.outcome;
      return integer(value.terminationTick) && (outcome === 'credited_delivery' || outcome === 'ineffective'
        || outcome === 'cancelled_or_removed' || outcome === 'demand_closed' || outcome === 'unobservable_at_completion')
        ? { ...fallback, outcome, terminationTick: value.terminationTick } : fallback;
    }
    case 'placed':
    case 'observing_result': {
      const baseline = cycle(value.baseline), evidence = score(value.score);
      if (baseline?.returnedTick === undefined || evidence === undefined || !integer(value.placedTick)) return fallback;
      const attempt = { ...key, attemptSiteId: value.attemptSiteId, placedTick: value.placedTick, baseline, score: evidence };
      if (value.status === 'placed') return { ...attempt, status: 'placed' };
      const deadline = opportunity(value.opportunity);
      return deadline !== undefined && integer(value.completedTick)
        ? { ...attempt, ...counters, status: 'observing_result', completedTick: value.completedTick, opportunity: deadline } : fallback;
    }
    default: return fallback;
  }
}
