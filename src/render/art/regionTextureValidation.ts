import type { ArtBundle } from './artContract';
import { isRegionTexture } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';
import { matches } from './artSelection';

export const REGION_BASES = ['chalk_down', 'coastal_grass', 'fen', 'heath', 'woodland_floor'] as const;
export const REGION_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
const ROLES = ['land-region-base-a', 'land-region-base-b', 'land-region-season-a', 'land-region-season-b'] as const;
export function validateRegionTextures(bundles: readonly ArtBundle[]): readonly ArtSchemaIssue[] {
  const entries = bundles.flatMap(b => b.entries).filter(isRegionTexture);
  const rules = bundles.flatMap(b => b.rules).filter(r => r.kind === 'ground-texture' && r.slot.startsWith('land-region-'));
  if (entries.length === 0 && rules.length === 0) return [];
  const issues: ArtSchemaIssue[] = [];
  const byId = new Map(entries.map(e => [e.id, e]));
  for (const rule of rules) {
    const base = rule.conditions.find(c => c.field === 'baseId');
    const season = rule.conditions.find(c => c.field === 'season');
    const seasonal = rule.slot === ROLES[2] || rule.slot === ROLES[3];
    const entry = byId.get(rule.variants[0]?.assetId ?? '');
    if (!ROLES.some(r => r === rule.slot) || rule.priority !== 0 || rule.variants.length !== 1 || rule.variants[0]?.weight !== 1
      || rule.conditions.length !== 2 || base?.op !== 'eq' || !REGION_BASES.some(b => b === base.value)
      || season?.op !== 'eq' || !REGION_SEASONS.some(s => s === season.value) || (seasonal && season.value !== 'spring')
      || entry === undefined || base.value !== entry.baseId)
      issues.push({ path: `$/rules/${rule.id}`, message: 'Region role requires supported base/season, matching XY source, priority zero and one unit-weight variant' });
  }
  for (const baseId of REGION_BASES) for (const season of REGION_SEASONS) {
    const counts = ROLES.map(slot => rules.filter(r => r.slot === slot && matches(r.conditions, { baseId, season })).length);
    if (counts[0] !== 1 || counts[1] !== 1 || counts[2] !== counts[3] || (counts[2] ?? 0) > 1)
      issues.push({ path: `$/region-textures/${baseId}/${season}`, message: 'Region requires all forty base roles and complete unique optional pairs' });
  }
  return issues;
}
