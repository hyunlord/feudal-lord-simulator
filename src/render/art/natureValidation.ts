import type { ArtBundle, NatureGroundEntry, WeatherParticleEntry } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';

const COUNTS = { 'snow-footprint': 2, snow: 3, 'blowing-snow': 1, splash: 6, 'leaf-roof': 1, rain: 12, 'leaf-flight': 12, 'leaf-wind': 2, 'leaf-ground': 6, 'leaf-water': 1, puddle: 6, mud: 2, 'wet-grass': 1, 'wet-soil': 1 } as const;
/** Family readiness requires complete authored roles; an absent role leaves its legacy consumer intact. */
export function validateNature(bundles: readonly ArtBundle[]): readonly ArtSchemaIssue[] {
  const entries = bundles.flatMap(bundle => bundle.entries).filter((entry): entry is NatureGroundEntry | WeatherParticleEntry => entry.kind === 'weather-particle' || (entry.kind === 'ground-prop' && entry.placement === 'nature-ground'));
  const rules = bundles.flatMap(bundle => bundle.rules).filter(rule => rule.slot.startsWith('nature-'));
  const issues: ArtSchemaIssue[] = [];
  for (const [role, expected] of Object.entries(COUNTS)) {
    const family = entries.filter(entry => entry.role === role);
    if (family.length !== 0 && family.length !== expected) issues.push({ path: `$/nature/${role}`, message: `Incomplete nature family: expected ${expected}` });
  }
  for (const entry of entries) {
    const owning = rules.filter(rule => rule.variants.some(variant => variant.assetId === entry.id));
    const rule = owning[0];
    if (owning.length !== 1 || rule?.kind !== entry.kind || rule.slot !== `nature-${entry.role}` || rule.conditions.length !== 2
      || !rule.conditions.some(c => c.op === 'eq' && c.field === 'role' && c.value === entry.role)
      || !rule.conditions.some(c => c.op === 'eq' && c.field === 'group' && c.value === entry.group)) issues.push({ path: `$/entries/${entry.id}`, message: 'Nature entry requires one matching role/group owner' });
    if (entry.geometry.allowMirror || entry.geometry.crop !== undefined || entry.geometry.footprint !== undefined) issues.push({ path: `$/entries/${entry.id}`, message: 'Nature sources preserve their full unmirrored canvas' });
    if (entry.kind === 'weather-particle' && entry.frames.some(frame => frame.pivot.x !== entry.geometry.pivot.x || frame.pivot.y !== entry.geometry.pivot.y)) issues.push({ path: `$/entries/${entry.id}`, message: 'Particle frame pivot differs from source contract' });
  }
  for (const rule of rules) if (rule.variants.some(variant => !entries.some(entry => entry.id === variant.assetId))) issues.push({ path: `$/rules/${rule.id}`, message: 'Nature rule references a non-nature source' });
  return issues;
}
