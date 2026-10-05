import { MAP_ARCHETYPES, RIVERSIDE_ARCHETYPE_ID } from '../../content/scenario/archetypes';
import type { ArtBundle, LandGroundPropEntry } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';
import { matches } from './artSelection';

export const LAND_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
/** Every declared rule and reference is checked over the actual finite consumer domain. */
export function validateLandDecals(bundles: readonly ArtBundle[]): readonly ArtSchemaIssue[] {
  const entries = bundles.flatMap(bundle => bundle.entries);
  const land = entries.filter((entry): entry is LandGroundPropEntry => entry.kind === 'ground-prop' && entry.placement === 'land');
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const rules = bundles.flatMap(bundle => bundle.rules).filter(rule => rule.slot === 'land-decal-base' || rule.slot === 'land-decal-variant' || rule.variants.some(v => land.some(e => e.id === v.assetId)));
  const issues: ArtSchemaIssue[] = [];
  const issue = (id: string, message: string): void => { issues.push({ path: `$/land-decals/${id}`, message }); };
  const usedRules = new Set<string>(); const usedEntries = new Set<string>();
  const domain: Readonly<Record<string, readonly string[]>> = {
    baseId: MAP_ARCHETYPES.flatMap(a => a.ground?.decals ?? []),
    archetype: MAP_ARCHETYPES.filter(a => a.id !== RIVERSIDE_ARCHETYPE_ID).map(a => a.id),
    placement: ['land'], season: LAND_SEASONS,
  };
  for (const rule of rules) {
    if (rule.kind !== 'ground-prop' || !['land-decal-base', 'land-decal-variant'].includes(rule.slot) || rule.priority !== 0
      || rule.conditions.some(c => !['baseId', 'archetype', 'placement', 'season'].includes(c.field))) issue(rule.id, 'Unsupported land rule slot, priority, kind or fact');
    for (const condition of rule.conditions) {
      const allowed = domain[condition.field];
      const values = condition.op === 'eq' ? [condition.value] : condition.op === 'in' ? condition.values : [];
      if (condition.op === 'range' || values.some(value => typeof value !== 'string' || !allowed?.includes(value))) issue(rule.id, 'Land condition contains an unsupported value');
    }
  }
  for (const entry of land) {
    if (entry.geometry.crop !== undefined) issue(entry.id, 'Land decals require the native full canvas');
    if (entry.archetypes.some(id => !MAP_ARCHETYPES.some(a => a.id === id && id !== RIVERSIDE_ARCHETYPE_ID && a.ground?.decals?.includes(entry.baseId)))) issue(entry.id, 'Unsupported map archetype/base combination');
  }
  for (const baseId of new Set(land.map(entry => entry.baseId))) {
    const archetypes = MAP_ARCHETYPES.filter(a => a.id !== RIVERSIDE_ARCHETYPE_ID && a.ground?.decals?.includes(baseId));
    if (archetypes.length === 0) issue(baseId, 'Unknown land base');
    for (const archetype of archetypes) for (const season of LAND_SEASONS) {
      const context = { baseId, archetype: archetype.id, placement: 'land', season };
      const applicable = rules.filter(rule => matches(rule.conditions, context));
      const bases = applicable.filter(rule => rule.slot === 'land-decal-base');
      if (bases.length !== 1 || bases.some(rule => rule.variants.length !== 1 || rule.variants[0]?.weight !== 1)) issue(baseId, `Exactly one unit base required for ${archetype.id}/${season}`);
      if (applicable.filter(rule => rule.slot === 'land-decal-variant').length > 1) issue(baseId, 'Ambiguous land variant rules');
      for (const rule of applicable) {
        usedRules.add(rule.id);
        for (const variant of rule.variants) {
          const entry = byId.get(variant.assetId);
          if (entry?.kind !== 'ground-prop' || entry.placement !== 'land' || entry.baseId !== baseId || !entry.archetypes.includes(archetype.id) || (entry.season !== undefined && entry.season !== season)) issue(rule.id, `Invalid land reference ${variant.assetId}`);
          else usedEntries.add(entry.id);
        }
      }
    }
  }
  for (const rule of rules) if (!usedRules.has(rule.id)) issue(rule.id, 'Land rule has no reachable consumer context');
  for (const entry of land) if (!usedEntries.has(entry.id)) issue(entry.id, 'Land entry has no valid rule reference');
  return issues;
}
