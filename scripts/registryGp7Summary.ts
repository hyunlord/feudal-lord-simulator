/** Version-one observation parser/report. Deliberately independent of current engine rules and catalog. */
export class Gp7InputError extends Error {
  constructor(readonly field: string) { super(`Invalid GP7 observation field: ${field}`); this.name = 'Gp7InputError'; }
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Gp7InputError(field);
  return Object.fromEntries(Object.entries(value));
}
function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Gp7InputError(field);
  return value;
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Gp7InputError(field);
  return value;
}
function list(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Gp7InputError(field);
  return value;
}
function strings(value: unknown, field: string): readonly string[] {
  const result = list(value, field).map(item => text(item, field));
  if (new Set(result).size !== result.length) throw new Gp7InputError(`duplicate ${field}`);
  return result;
}
function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Gp7InputError(field);
  return value;
}
function historyExample(value: unknown) {
  const row = object(value, 'chronicle.example');
  const subject = object(row.subject, 'example.subject');
  const subjectType = text(subject.type, 'subject.type');
  if (!['town', 'household', 'person', 'faction', 'lineage'].includes(subjectType)) throw new Gp7InputError('subject.type');
  const params: Record<string, string | number> = {};
  if (row.params !== undefined) {
    for (const [key, param] of Object.entries(object(row.params, 'example.params'))) {
      if (typeof param !== 'string' && (typeof param !== 'number' || !Number.isFinite(param))) throw new Gp7InputError('example.params.value');
      params[key] = param;
    }
  }
  const because = row.because === undefined ? undefined : list(row.because, 'example.because').map(value => {
    const item = object(value, 'example.because.item');
    if (item.part !== undefined && item.part !== true) throw new Gp7InputError('because.part');
    return { decisionId: text(item.decisionId, 'because.decisionId'), key: text(item.key, 'because.key'),
      ...(item.part === undefined ? {} : { part: true }) };
  });
  return { id: text(row.id, 'example.id'), tick: integer(row.tick, 'example.tick'), kind: text(row.kind, 'example.kind'),
    template: text(row.template, 'example.template'), subject: { type: subjectType, id: text(subject.id, 'subject.id') },
    ...(row.params === undefined ? {} : { params }), ...(because === undefined ? {} : { because }) };
}

export function summarizeRegistryGp7(input: unknown, range: { readonly startYear: number; readonly endYearExclusive: number }) {
  const raw = object(input, 'gp7Observation');
  if (raw.schemaVersion !== 1) throw new Gp7InputError('schemaVersion');
  if (raw.meaning !== 'resolved_or_lapsed_trace_tick_not_offer_arrival') throw new Gp7InputError('meaning');
  const coverage = object(raw.coverage, 'coverage');
  const observations = integer(coverage.observations, 'coverage.observations');
  const firstTick = coverage.firstTick === null ? null : integer(coverage.firstTick, 'coverage.firstTick');
  const lastTick = coverage.lastTick === null ? null : integer(coverage.lastTick, 'coverage.lastTick');
  const maxGap = integer(coverage.maxGap, 'coverage.maxGap');
  const timeReversals = integer(coverage.timeReversals, 'coverage.timeReversals');
  if ((observations === 0) !== (firstTick === null && lastTick === null) || (firstTick === null) !== (lastTick === null)
    || timeReversals >= Math.max(1, observations) || (observations < 2 && maxGap !== 0)) throw new Gp7InputError('coverage consistency');
  if (firstTick !== null && lastTick !== null && timeReversals === 0
    && (lastTick < firstTick || maxGap > lastTick - firstTick || lastTick - firstTick > maxGap * (observations - 1))) throw new Gp7InputError('coverage span');
  const calendar = raw.calendar === null ? null : object(raw.calendar, 'calendar');
  if ((observations === 0) !== (calendar === null)) throw new Gp7InputError('calendar coverage');
  const calendarStart = calendar === null ? 0 : integer(calendar.startYear, 'calendar.startYear');
  const ticksPerYear = calendar === null ? 1 : integer(calendar.ticksPerYear, 'calendar.ticksPerYear');
  if (ticksPerYear === 0) throw new Gp7InputError('calendar.ticksPerYear');
  const yearAt = (tick: number) => calendarStart + Math.floor(tick / ticksPerYear);
  const ids = new Set<string>();
  const decisions = list(raw.decisions, 'decisions').map(value => {
    const row = object(value, 'decision');
    const id = text(row.id, 'decision.id');
    if (ids.has(id)) throw new Gp7InputError('duplicate decision.id');
    ids.add(id);
    const tick = integer(row.tick, 'decision.tick');
    const year = integer(row.year, 'decision.year');
    const by = text(row.by, 'decision.by');
    if (by !== 'lord' && by !== 'steward') throw new Gp7InputError('decision.by');
    const weights = strings(row.weights, 'decision.weights');
    if (weights.some(weight => !['rights', 'land', 'marriage', 'inheritance', 'wardship', 'large_sum', 'years_promise', 'faction_rupture', 'crisis'].includes(weight))) throw new Gp7InputError('decision.weights');
    const cameHeavyToLord = boolean(row.cameHeavyToLord, 'decision.cameHeavyToLord');
    if (yearAt(tick) !== year || (cameHeavyToLord && (by !== 'lord' || weights.length === 0))) throw new Gp7InputError('decision year/weight consistency');
    if (row.lapsed !== undefined && row.lapsed !== true) throw new Gp7InputError('decision.lapsed');
    if (row.lastTick !== undefined && integer(row.lastTick, 'decision.lastTick') < tick) throw new Gp7InputError('decision.lastTick');
    if (row.also !== undefined) strings(row.also, 'decision.also');
    if (row.policy !== undefined && !['customary', 'lenient', 'strict', 'lord'].includes(text(row.policy, 'decision.policy'))) throw new Gp7InputError('decision.policy');
    const kind = text(row.kind, 'decision.kind');
    if (!['registry', 'manor_petition', 'estate_petition', 'chapter_petition', 'famine', 'suit', 'marriage', 'oversight', 'audit', 'policy', 'subsidy', 'dues', 'timber', 'standing_policy'].includes(kind)) throw new Gp7InputError('decision.kind');
    return { id, tick, year, by, weights, cameHeavyToLord, kind, source: text(row.source, 'decision.source'),
      targets: strings(row.targets, 'decision.targets'), lapsed: row.lapsed === true };
  }).sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id));
  const groupKeys = new Set<string>();
  const exampleRepresentations = new Set<string>();
  const chronicle = list(raw.chronicle, 'chronicle').map(value => {
    const row = object(value, 'chronicle.group');
    const year = integer(row.year, 'chronicle.year');
    const kind = text(row.kind, 'chronicle.kind');
    if (!['decision', 'event', 'person', 'faction', 'era', 'milestone', 'ledger'].includes(kind)) throw new Gp7InputError('chronicle.kind');
    const template = text(row.template, 'chronicle.template');
    const key = JSON.stringify([year, kind, template]);
    if (groupKeys.has(key)) throw new Gp7InputError('duplicate chronicle group');
    groupKeys.add(key);
    const count = integer(row.count, 'chronicle.count');
    const example = historyExample(row.example);
    const representation = JSON.stringify([example.id, example.kind, example.template, year]);
    if (exampleRepresentations.has(representation)) throw new Gp7InputError('duplicate chronicle example representation');
    exampleRepresentations.add(representation);
    if (count === 0 || example.kind !== kind || example.template !== template || yearAt(example.tick) !== year) throw new Gp7InputError('chronicle example consistency');
    return { year, kind, template, count, example };
  }).sort((a, b) => a.year - b.year || a.kind.localeCompare(b.kind) || a.template.localeCompare(b.template));
  if (lastTick !== null && timeReversals === 0 && (decisions.some(row => row.tick > lastTick) || chronicle.some(row => row.example.tick > lastTick))) throw new Gp7InputError('evidence beyond coverage');
  if (observations === 0 && (decisions.length > 0 || chronicle.length > 0)) throw new Gp7InputError('unobserved evidence');
  const complete = firstTick !== null && lastTick !== null && firstTick <= (range.startYear - calendarStart) * ticksPerYear
    && lastTick >= (range.endYearExclusive - calendarStart) * ticksPerYear && maxGap <= 1 && timeReversals === 0;
  const boundary = (predicate: (year: number) => boolean) => ({ decisions: decisions.filter(row => predicate(row.year)).length,
    chronicleRecords: chronicle.filter(row => predicate(row.year)).reduce((sum, row) => sum + row.count, 0) });
  return { status: 'measured_not_adjudicated' as const, schemaVersion: 1,
    meaning: 'Resolved or lapsed trace decisions at decision.tick, classified by the source engine cameHeavyToLord predicate; not offer arrivals.',
    evidenceMeaning: 'Chronicle model records, not screenshots or verified player-visible changes. Rollups are separate; no causal share or GP7 pass/fail is inferred.',
    coverage: { status: complete ? 'complete' : 'incomplete', firstTick, lastTick, observations, maxGap, timeReversals },
    boundary: { before: boundary(year => year < range.startYear), after: boundary(year => year >= range.endYearExclusive) },
    annual: Array.from({ length: range.endYearExclusive - range.startYear }, (_, offset) => {
      const year = range.startYear + offset;
      const rows = decisions.filter(row => row.year === year);
      const evidence = chronicle.filter(row => row.year === year);
      const heavy = rows.filter(row => row.cameHeavyToLord);
      return { year, resolvedHeavyToLord: heavy.length, lapsedHeavyToLord: heavy.filter(row => row.lapsed).length,
        lordDecisions: rows.filter(row => row.by === 'lord').length, stewardDecisions: rows.filter(row => row.by === 'steward').length,
        quietByResolvedTrace: complete ? heavy.length === 0 : null,
        chronicleRecords: evidence.filter(row => row.template !== 'ledger.rollup').reduce((sum, row) => sum + row.count, 0),
        rollupRecords: evidence.filter(row => row.template === 'ledger.rollup').reduce((sum, row) => sum + row.count, 0),
        decisionIds: rows.map(row => row.id), evidence };
    }) };
}
