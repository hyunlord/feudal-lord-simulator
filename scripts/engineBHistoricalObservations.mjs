const GATES = Object.freeze({
  candidate: ['support', 'calendar', 'once_or_pace', 'year_limit', 'gap', 'chance', 'chapter_prepare', 'binding_or_context', 'open_key', 'used_context', 'enabled_choices', 'accepted'],
  v4_selection: ['ordered_candidate'],
  v4_outer: ['budget', 'no_weight', 'selection_start', 'no_chosen', 'chosen', 'selected_prepare_null', 'constructed_offer', 'legacy_suppressed'],
  layer: ['unweighed_return', 'crowded_rejected', 'heavy_admitted', 'light_no_pick', 'light_unsettled', 'steward_answered'],
  legacy_selection: ['budget_or_empty', 'selection_start', 'ordered_candidate', 'chosen', 'constructed_offer'],
});
const check = (condition, message) => { if (!condition) throw new Error(`Historical observations: ${message}`); };
const empty = () => ({ records: 0, gateCounts: {}, firstTick: null, lastTick: null });
const text = value => typeof value === 'string' && value.length > 0;
function validate(record) {
  check(record !== null && typeof record === 'object' && !Array.isArray(record), 'scalar record required');
  check(Object.values(record).every(value => value === null || typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))), 'non-scalar or non-finite field');
  check(Object.hasOwn(GATES, record.scope) && GATES[record.scope].includes(record.gate), 'unknown scope/gate');
  check(Number.isSafeInteger(record.tick) && record.tick >= 0, 'invalid tick');
  const attributed = ['candidate', 'v4_selection', 'layer'].includes(record.scope)
    || ['chosen', 'selected_prepare_null', 'constructed_offer', 'ordered_candidate'].includes(record.gate);
  check(attributed ? text(record.entryId) : !Object.hasOwn(record, 'entryId'), 'invalid entry attribution');
  if (record.scope === 'candidate') {
    check(record.enabledChoices === null && record.enabledChoicesObserved === false, 'enabled-choice count is unobserved');
    check(record.choiceEvaluationReached === ['enabled_choices', 'accepted'].includes(record.gate), 'invalid choice-evaluation flag');
  }
  if (record.scope === 'layer' || record.gate === 'constructed_offer') check(text(record.offeredId), 'offeredId required');
  if (record.gate === 'ordered_candidate') {
    check(Number.isSafeInteger(record.position) && record.position >= 0, 'invalid candidate position');
    check(['weight', 'rangeFrom', 'rangeTo', 'total', 'initialPick'].every(key => typeof record[key] === 'number' && Number.isFinite(record[key])), 'selection scalars required');
    check(record.weight >= 0 && record.rangeFrom >= 0 && record.rangeTo === record.rangeFrom + record.weight
      && record.rangeTo <= record.total && record.initialPick >= 0 && record.initialPick < record.total, 'invalid selection range');
  }
  if (record.gate === 'legacy_suppressed') {
    check(typeof record.chosenIdsJson === 'string', 'legacy chosen IDs JSON required');
    const ids = JSON.parse(record.chosenIdsJson);
    check(Array.isArray(ids) && ids.length > 0 && ids.every(text), 'invalid legacy chosen IDs');
  }
  return attributed;
}
function count(target, record) {
  target.records += 1;
  const key = `${record.scope}.${record.gate}`;
  target.gateCounts[key] = (target.gateCounts[key] ?? 0) + 1;
  target.firstTick = target.firstTick === null ? record.tick : Math.min(target.firstTick, record.tick);
  target.lastTick = target.lastTick === null ? record.tick : Math.max(target.lastTick, record.tick);
}

// Caller supplies reference.absentEntryIds; aggregation does not authenticate the reference or replay.
export function createHistoricalObservations(absentEntryIds) {
  check(Array.isArray(absentEntryIds) && absentEntryIds.length === 40
    && absentEntryIds.every(id => typeof id === 'string' && /^ck_evt_\d{3}$/.test(id))
    && new Set(absentEntryIds).size === 40, 'forty unique historical entry IDs required');
  const rows = new Map([...absentEntryIds].sort().map(entryId => [entryId, { entryId, ...empty(),
    acceptedCandidateRecords: 0, orderedCandidateRecords: 0, chosenRecords: 0, constructedOfferRecords: 0, layerRecords: 0,
    enabledChoiceCountObserved: false }]));
  const global = empty(), nonTarget = empty();
  let records = 0;
  return {
    observe(record) {
      const attributed = validate(record);
      const row = attributed ? rows.get(record.entryId) : undefined;
      records += 1;
      count(row ?? (attributed ? nonTarget : global), record);
      if (!row) return;
      if (record.scope === 'candidate' && record.gate === 'accepted') row.acceptedCandidateRecords += 1;
      if (record.gate === 'ordered_candidate') row.orderedCandidateRecords += 1;
      if (record.gate === 'chosen') row.chosenRecords += 1;
      if (record.gate === 'constructed_offer') row.constructedOfferRecords += 1;
      if (record.scope === 'layer') row.layerRecords += 1;
    },
    snapshot() {
      return structuredClone({ scope: 'supplied replay observation records only', records, rows: [...rows.values()], global, nonTarget,
        unobserved: ['exact enabled-choice counts', 'internal binding/context rejection detail', 'unvisited candidate gates', 'original historical hidden causes'],
        limits: ['Record counts are not unique seasons, candidates or offers.', 'Empty rows do not prove absence of producers or eligibility.',
          'Reference authenticity, stream completeness, observer failures, source, projection parity and runtime acceptance are not evaluated.'],
        applicabilityAllowed: false, fullStateComparable: false, originalRuntimeVerified: false });
    },
  };
}
