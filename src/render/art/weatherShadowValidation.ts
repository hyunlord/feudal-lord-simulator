import type { ArtBundle } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';

const ROLES = ['cloud-base-lower', 'cloud-base-upper', 'cloud-variant-lower', 'cloud-variant-upper'] as const;
/** Complete absence is valid for unrelated registries; partial ownership is never a usable weather family. */
export function validateWeatherShadows(bundles: readonly ArtBundle[]): readonly ArtSchemaIssue[] {
  const entries = bundles.flatMap(bundle => bundle.entries).filter(entry => entry.kind === 'weather-shadow');
  const rules = bundles.flatMap(bundle => bundle.rules).filter(rule => rule.kind === 'weather-shadow' || rule.slot.startsWith('cloud-'));
  if (entries.length === 0 && rules.length === 0) return [];
  const issues: ArtSchemaIssue[] = [];
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const references = new Set<string>();
  for (const entry of entries) {
    if (entry.image.height > entry.image.width || entry.geometry.pivot.x !== entry.image.width / 2 || entry.geometry.pivot.y !== entry.image.height / 2)
      issues.push({ path: `$/entries/${entry.id}`, message: 'Weather shadow requires landscape or square canvas and exact center pivot' });
  }
  for (const rule of rules) {
    const condition = rule.conditions[0];
    const variant = rule.variants[0];
    const entry = variant === undefined ? undefined : byId.get(variant.assetId);
    const expectedDeck = rule.slot.endsWith('-lower') ? 'lower' : 'upper';
    if (!ROLES.some(role => role === rule.slot) || rule.kind !== 'weather-shadow' || rule.priority !== 0
      || rule.conditions.length !== 1 || condition?.op !== 'eq' || condition.field !== 'weather' || condition.value !== 'normal'
      || rule.variants.length !== 1 || variant?.weight !== 1 || entry === undefined || entry.deck !== expectedDeck
      || references.has(variant.assetId))
      issues.push({ path: `$/rules/${rule.id}`, message: 'Weather role requires unique matching deck, normal predicate, zero priority and one unit-weight variant' });
    if (variant !== undefined) references.add(variant.assetId);
  }
  const counts = ROLES.map(slot => rules.filter(rule => rule.slot === slot).length);
  if (counts[0] !== 1 || counts[1] !== 1 || counts[2] !== counts[3] || (counts[2] ?? 0) > 1)
    issues.push({ path: '$/weather-shadows', message: 'Weather shadows require base2 and either zero or two variant roles' });
  for (const entry of entries) if (!references.has(entry.id))
    issues.push({ path: `$/entries/${entry.id}`, message: 'Weather shadow has no owning role' });
  return issues;
}
