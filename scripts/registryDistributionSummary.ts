import { summarizeRegistryGp7 } from './registryGp7Summary';
export interface DistributionOptions {
  readonly catalog: readonly { readonly id: string; readonly category: string }[];
  readonly enabledEntryIds?: readonly string[];
  readonly legacyRange?: { readonly startYear: number; readonly endYearExclusive: number };
}
export class DistributionInputError extends Error {
  constructor(path: string) { super(`Invalid registry run field: ${path}`); this.name = 'DistributionInputError'; }
}
function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new DistributionInputError(path);
  return Object.fromEntries(Object.entries(value));
}
function integer(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new DistributionInputError(path);
  return value;
}
function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new DistributionInputError(path);
  return value;
}
function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new DistributionInputError(path);
  return value;
}
interface Occurrence { readonly entry: string; readonly year: number; readonly status: string }
const ERA_EDGES = [1315, 1323, 1337, 1348, 1351, 1381] as const;

/** Pure report of observed data. Catalog and supported IDs must describe the run's own revision. */
export function summarizeRegistryDistribution(input: unknown, options: DistributionOptions) {
  const run = object(input, 'run');
  const explicitRange = run.startYear !== undefined || run.endYearExclusive !== undefined;
  const startYear = integer(explicitRange ? run.startYear : options.legacyRange?.startYear, 'startYear');
  const endYearExclusive = integer(explicitRange ? run.endYearExclusive : options.legacyRange?.endYearExclusive, 'endYearExclusive');
  if (endYearExclusive <= startYear) throw new DistributionInputError('year range');
  const catalog = new Map<string, string>();
  for (const entry of options.catalog) {
    if (catalog.has(entry.id)) throw new DistributionInputError('duplicate catalog ID');
    catalog.set(string(entry.id, 'catalog.id'), string(entry.category, 'catalog.category'));
  }
  const ids = new Set<string>();
  const occurrences: readonly Occurrence[] = array(run.occurrences, 'occurrences').map((value, index) => {
    const row = object(value, `occurrences[${index}]`);
    if (row.id !== undefined) {
      const id = string(row.id, 'occurrence.id');
      if (ids.has(id)) throw new DistributionInputError('duplicate occurrence.id');
      ids.add(id);
    }
    return { entry: string(row.entry, 'occurrence.entry'), year: integer(row.year, 'occurrence.year'), status: string(row.status, 'occurrence.status') };
  });
  const edges = [startYear, ...ERA_EDGES.filter(year => year > startYear && year < endYearExclusive), endYearExclusive];
  function group(rows: readonly Occurrence[]) {
    const categories = new Map<string | null, number>();
    const statuses = new Map<string, number>();
    for (const row of rows) {
      const category = catalog.get(row.entry) ?? null;
      categories.set(category, (categories.get(category) ?? 0) + 1);
      statuses.set(row.status, (statuses.get(row.status) ?? 0) + 1);
    }
    return { total: rows.length, distinctEntryIds: [...new Set(rows.map(row => row.entry))].sort(),
      unknownEntryIds: [...new Set(rows.filter(row => !catalog.has(row.entry)).map(row => row.entry))].sort(),
      categories: [...categories].map(([category, count]) => ({ category, count })),
      statuses: [...statuses].map(([status, count]) => ({ status, count })) };
  }
  const inside = occurrences.filter(row => row.year >= startYear && row.year < endYearExclusive);
  const grouped = group(inside);
  const eras = edges.slice(0, -1).map((from, index) => {
    const until = edges[index + 1] ?? endYearExclusive;
    return { startYear: from, endYearExclusive: until, count: inside.filter(row => row.year >= from && row.year < until).length };
  });
  const modern = new Map<number, { readonly allCommands: number; readonly askedResponses: number; readonly arrivedQueue: number }>();
  if (run.annualDensity !== undefined) {
    for (const value of array(run.annualDensity, 'annualDensity')) {
      const row = object(value, 'annualDensity.row');
      const year = integer(row.year, 'annualDensity.year');
      if (modern.has(year)) throw new DistributionInputError('duplicate annualDensity.year');
      const allCommands = integer(row.allCommands, 'allCommands');
      const askedResponses = integer(row.askedCommandResponses, 'askedCommandResponses');
      if (askedResponses > allCommands) throw new DistributionInputError('askedCommandResponses exceeds allCommands');
      modern.set(year, { allCommands, askedResponses,
        arrivedQueue: integer(row.arrivedDecisionItems, 'arrivedDecisionItems') });
    }
  }
  const legacy = new Map<number, number>();
  if (run.decisionsByYear !== undefined) {
    for (const [key, value] of Object.entries(object(run.decisionsByYear, 'decisionsByYear'))) {
      const year = integer(Number(key), 'decisionsByYear.year');
      if (String(year) !== key) throw new DistributionInputError('decisionsByYear.year');
      legacy.set(year, integer(value, 'decisionsByYear.count'));
    }
  }
  const density = Array.from({ length: endYearExclusive - startYear }, (_, offset) => {
    const year = startYear + offset;
    const current = modern.get(year);
    return { year, allCommands: current?.allCommands ?? (run.annualDensity !== undefined ? null : run.decisionsByYear !== undefined ? legacy.get(year) ?? 0 : null),
      askedResponses: current?.askedResponses ?? null,
      arrivedQueue: current?.arrivedQueue ?? null };
  });
  const metadata = run.occurrenceRetention === undefined ? null : object(run.occurrenceRetention, 'occurrenceRetention');
  const offeredCount = run.registryOffers === undefined ? null : integer(run.registryOffers, 'registryOffers');
  const observed = metadata?.observed === undefined ? null : integer(metadata.observed, 'occurrenceRetention.observed');
  const openAbsent = metadata?.openWhenLastObservedAndAbsent === undefined ? null
    : integer(metadata.openWhenLastObservedAndAbsent, 'occurrenceRetention.openWhenLastObservedAndAbsent');
  if ((offeredCount !== null && offeredCount < occurrences.length) || (observed !== null && observed < occurrences.length)) {
    throw new DistributionInputError('declared occurrence count is below observed rows');
  }
  const lost = (offeredCount !== null && offeredCount > occurrences.length) || (observed !== null && observed > occurrences.length);
  const retentionStatus = lost ? 'incomplete' : metadata?.scope === 'entire_run_observed' && observed === occurrences.length ? 'complete' : 'unknown';
  const enabled = options.enabledEntryIds === undefined ? null : [...new Set(options.enabledEntryIds.map(id => string(id, 'enabledEntryIds')))];
  return { range: { startYear, endYearExclusive, source: explicitRange ? 'run' : 'caller_legacy_range' },
    inRange: { ...grouped, eras }, boundary: { before: group(occurrences.filter(row => row.year < startYear)), after: group(occurrences.filter(row => row.year >= endYearExclusive)) },
    density, densityMeaning: 'allCommands includes proactive commands; askedResponses counts state-changing responses; arrivedQueue counts observed queue items, not foreground cards',
    retention: { status: retentionStatus, statusHistory: openAbsent === 0 && retentionStatus === 'complete' ? 'latest_observed' : 'possibly_incomplete',
      observedRows: occurrences.length, declaredOffers: offeredCount },
    support: enabled === null ? null : { enabledCount: enabled.length, observedEnabled: grouped.distinctEntryIds.filter(id => enabled.includes(id)),
      enabledNotObserved: enabled.filter(id => !grouped.distinctEntryIds.includes(id)), observedNotEnabled: grouped.distinctEntryIds.filter(id => !enabled.includes(id)) },
    gp7: run.gp7Observation === undefined ? { status: 'not_evaluated', reason: 'Heavy-decision weight tags and quiet-year world-change evidence are not provided; empty years are not a failure gate.' } : summarizeRegistryGp7(run.gp7Observation, { startYear, endYearExclusive }) };
}
