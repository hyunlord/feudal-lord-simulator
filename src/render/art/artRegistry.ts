import { validateSpringWorld } from './springWorldValidation';
import schema from './artContract.schema.json';
import type { ArtBundle, ArtEntry, ArtKind, ArtRule } from './artContract';
import { validateArtSchema } from './schemaValidation';
import type { ArtSchemaIssue } from './schemaValidation';
import { validateRegistryData } from './artRegistryValidation';
import { conditionBoundaries, matches, validateSelection } from './artSelection';
import type { ArtContext } from './artSelection';
export { ART_CONTEXT_FIELDS } from './artSelection';
export type { ArtContext, ArtContextField } from './artSelection';

export class ArtRegistryError extends Error {
  readonly issues: readonly ArtSchemaIssue[];
  constructor(issues: readonly ArtSchemaIssue[]) {
    super(issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
    this.name = 'ArtRegistryError';
    this.issues = Object.freeze(issues.map(issue => Object.freeze({ ...issue })));
  }
}
export interface ArtRegistry {
  entry(id: string): ArtEntry | null;
  entries(kind?: ArtKind): readonly ArtEntry[];
  select(kind: ArtKind, slot: string, context: ArtContext, seed: number): ArtEntry | null;
  nextChange(kind: ArtKind, slot: string, context: ArtContext, field: string): number | null;
  boundaries(kind: ArtKind, slot: string, field: string): readonly number[];
}
/** This predicate is the single schema boundary; semantics run before snapshots are published. */
function isBundle(value: unknown): value is ArtBundle {
  const issues = validateArtSchema(value, schema);
  if (issues.length) throw new ArtRegistryError(issues);
  return true;
}
function freezeTree(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  for (const child of Object.values(value)) freezeTree(child);
  Object.freeze(value);
}
function selectedRule(rules: readonly ArtRule[], context: ArtContext): ArtRule | undefined {
  return rules.find(rule => matches(rule.conditions, context));
}
export function createArtRegistry(bundles: readonly unknown[]): ArtRegistry {
  const validated: ArtBundle[] = [];
  for (const bundle of bundles) if (isBundle(bundle)) validated.push(bundle);
  const rules = validated.flatMap(bundle => bundle.rules);
  const issues = [...validateRegistryData(validated), ...validateSpringWorld(validated), ...validateSelection(rules)];
  if (issues.length) throw new ArtRegistryError(issues);
  const snapshots = structuredClone(validated);
  freezeTree(snapshots);
  const entries = Object.freeze(snapshots.flatMap(bundle => bundle.entries));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const orderedRules = snapshots.flatMap(bundle => bundle.rules).sort((a, b) => b.priority - a.priority);
  const matchingRules = (kind: ArtKind, slot: string): readonly ArtRule[] => orderedRules.filter(rule => rule.kind === kind && rule.slot === slot);
  const registry: ArtRegistry = {
    entry: id => byId.get(id) ?? null,
    entries: kind => kind === undefined ? entries : Object.freeze(entries.filter(entry => entry.kind === kind)),
    select: (kind, slot, context, seed) => {
      if (!Number.isSafeInteger(seed)) throw new ArtRegistryError([{ path: '$/seed', message: 'Expected safe integer selection seed' }]);
      const rule = selectedRule(matchingRules(kind, slot), context);
      if (!rule) return null;
      const total = rule.variants.reduce((sum, variant) => sum + variant.weight, 0);
      // BigInt keeps integer remainders exact even for totals near MAX_SAFE_INTEGER.
      const totalBig = BigInt(total);
      let ticket = (BigInt(seed) % totalBig + totalBig) % totalBig;
      for (const variant of rule.variants) {
        if (ticket < BigInt(variant.weight)) return byId.get(variant.assetId) ?? null;
        ticket -= BigInt(variant.weight);
      }
      return null;
    },
    boundaries: (kind, slot, field) => Object.freeze([...new Set(matchingRules(kind, slot).flatMap(rule => conditionBoundaries(rule.conditions, field)))].sort((a, b) => a - b)),
    nextChange: (kind, slot, context, field) => {
      const current = Object.hasOwn(context, field) ? context[field] : undefined;
      if (typeof current !== 'number' || !Number.isFinite(current)) return null;
      const candidates = matchingRules(kind, slot).filter(rule => matches(rule.conditions.filter(condition => condition.field !== field), context));
      const boundaries = [...new Set(candidates.flatMap(rule => conditionBoundaries(rule.conditions, field)))].filter(value => value > current).sort((a, b) => a - b);
      const currentRule = selectedRule(candidates, context);
      for (const boundary of boundaries) if (selectedRule(candidates, { ...context, [field]: boundary }) !== currentRule) return boundary;
      return null;
    },
  };
  return Object.freeze(registry);
}
/** Failed construction cannot replace or mutate the prior immutable snapshot. */
export class ArtRegistryStore {
  #registry: ArtRegistry;
  constructor(bundles: readonly unknown[] = []) { this.#registry = createArtRegistry(bundles); }
  get registry(): ArtRegistry { return this.#registry; }
  replace(bundles: readonly unknown[]): ArtRegistry {
    const next = createArtRegistry(bundles);
    this.#registry = next;
    return next;
  }
}
