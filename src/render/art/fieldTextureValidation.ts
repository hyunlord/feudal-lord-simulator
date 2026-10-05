import type { ArtBundle } from './artContract';
import { isFieldTexture } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';
import { matches } from './artSelection';

export const FIELD_TEXTURE_STATES = ['ploughed', 'seedling'] as const;
export type FieldTextureState = typeof FIELD_TEXTURE_STATES[number];
export const FIELD_TEXTURE_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
const ROLES = ['field-ridge-base-a', 'field-ridge-base-b', 'field-ridge-season-a', 'field-ridge-season-b'] as const;
/** Finite startup validation precedes all image requests and factory publication. */
export function validateFieldTextures(bundles: readonly ArtBundle[]): readonly ArtSchemaIssue[] {
  const entries = bundles.flatMap(bundle => bundle.entries).filter(isFieldTexture);
  const rules = bundles.flatMap(bundle => bundle.rules).filter(rule => rule.kind === 'ground-texture' && !rule.slot.startsWith('land-region-'));
  if (entries.length === 0 && rules.length === 0) return [];
  const issues: ArtSchemaIssue[] = [];
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  for (const rule of rules) {
    const path = `$/rules/${rule.id}`;
    const base = rule.slot === ROLES[0] || rule.slot === ROLES[1];
    const state = rule.conditions.find(condition => condition.field === 'fieldState');
    const season = rule.conditions.find(condition => condition.field === 'season');
    if (!ROLES.some(role => role === rule.slot) || rule.priority !== 0 || rule.variants.length !== 1 || rule.variants[0]?.weight !== 1)
      issues.push({ path, message: 'Field texture role requires known slot, priority zero and a single unit-weight source' });
    if (state?.op !== 'eq' || !FIELD_TEXTURE_STATES.some(value => value === state.value) || rule.conditions.length !== (base ? 1 : 2)
      || (!base && (season?.op !== 'eq' || !FIELD_TEXTURE_SEASONS.some(value => value === season.value))))
      issues.push({ path, message: 'Field texture rule requires exact supported fieldState and seasonal role season' });
    const entry = byId.get(rule.variants[0]?.assetId ?? '');
    if (entry === undefined || entry.composition.wash !== (base ? 'legacy-stage' : 'none'))
      issues.push({ path, message: 'Field texture source missing or wash policy differs from role' });
  }
  for (const fieldState of FIELD_TEXTURE_STATES) for (const season of FIELD_TEXTURE_SEASONS) {
    const selected = ROLES.map(slot => rules.filter(rule => rule.slot === slot && matches(rule.conditions, { fieldState, season })));
    const [baseA, baseB, seasonA, seasonB] = selected;
    if (baseA?.length !== 1 || baseB?.length !== 1 || seasonA === undefined || seasonB === undefined || seasonA.length !== seasonB.length || seasonA.length > 1)
      issues.push({ path: `$/field-textures/${fieldState}/${season}`, message: 'Field texture requires complete unique base pair and either zero or two seasonal roles' });
    // Source geometry/mapping are exact schema constants; wash is checked against each role above.
  }
  return issues;
}
