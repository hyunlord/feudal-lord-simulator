export interface AutoplaySearchDiagnostic {
  readonly reason: 'search_complete' | 'search_budget_hit';
  readonly used: number;
  readonly limit: number;
}
interface SearchContext { used: number; readonly limit: number; hit: boolean; exhausted: boolean }
export interface SearchDiagnosticCollector { search?: AutoplaySearchDiagnostic }
const DEFAULT_SEARCH_WORK = 192;
let active: SearchContext | undefined;

/** S8-R9: count expensive projected allocation/route probes, never elapsed time. */
export function spendAutoplaySearch(work = 1): boolean {
  if (active === undefined) return true;
  if (active.exhausted || active.used + work > active.limit) { active.hit = true; active.exhausted = true; active.used = active.limit; return false; }
  active.used += work;
  return true;
}
export function autoplaySearchActive(): boolean { return active !== undefined; }
export function autoplaySearchWorkUsed(): number | undefined { return active?.used; }
export function autoplaySearchExhausted(): boolean { return active?.exhausted ?? false; }
export function markAutoplaySearchLimit(): void { if (active !== undefined) active.hit = true; }
export function runAutoplaySearch<T>(run: () => T, diagnostic?: SearchDiagnosticCollector, limit = DEFAULT_SEARCH_WORK * 10): T {
  const previous = active;
  const context: SearchContext = { used: 0, limit, hit: false, exhausted: false };
  active = context;
  try { return run(); }
  finally {
    active = previous;
    if (diagnostic !== undefined) diagnostic.search = {
      reason: context.hit ? 'search_budget_hit' : 'search_complete', used: context.used, limit,
    };
  }
}

/** Independent priorities retain their own bounded opportunity after an impossible earlier search. */
export function runAutoplaySearchPhase<T>(run: () => T): T {
  if (active === undefined) return run();
  const parent = active;
  const phase: SearchContext = { used: 0, limit: Math.min(DEFAULT_SEARCH_WORK, parent.limit), hit: false, exhausted: false };
  active = phase;
  try { return run(); }
  finally {
    active = parent;
    parent.used += phase.used;
    parent.hit ||= phase.hit;
  }
}
