import type { ArtBundle, ArtCondition, ArtRule, SeasonalGroundPropEntry } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';

export const SEASONAL_GROUND_SLOT = 'seasonal-leaves';
export const SEASONAL_GROUND_PLACEMENT = 'seasonal-ground';
export const SEASONAL_LEAF_IDS = ['leaves_a', 'leaves_b', 'leaves_c'] as const;
const expectedUrls = new Map<string, string>(SEASONAL_LEAF_IDS.map(id => [id, `assets/wave7/season/${id}-v1.png`]));
const expectedInbox = new Map<string, string>(SEASONAL_LEAF_IDS.map(id => [id, `assets-inbox/wave7/candidates-v1/assets/season/${id}-v1.png`]));
const expectedSha = new Map<string, string>([
  ['leaves_a', '95f8a92da9c6a7476666d70aaeac444005d50c6dcaced9740b92d3880b0cc0be'],
  ['leaves_b', '46655eb8036284018d0e3b7a8e4250ef0408f604cb275c74bd3cfbe0d5975222'],
  ['leaves_c', 'ae47f56c0b476891280101cf0d3b9ca3aa2a46a72cfb644894ed0cbfb39ab84d'],
]);

function isSeasonalGroundEntry(entry: ArtBundle['entries'][number]): entry is SeasonalGroundPropEntry {
  return entry.kind === 'ground-prop' && entry.placement === SEASONAL_GROUND_PLACEMENT;
}
function conditionMatches(condition: ArtCondition, field: string, value: string): boolean {
  return condition.op === 'eq' && condition.field === field && condition.value === value;
}
function isLeafReference(rule: ArtRule): boolean {
  return rule.slot === SEASONAL_GROUND_SLOT || rule.variants.some(variant => SEASONAL_LEAF_IDS.some(id => id === variant.assetId));
}
function sameIds(ids: readonly string[]): boolean {
  return ids.length === SEASONAL_LEAF_IDS.length && SEASONAL_LEAF_IDS.every((id, index) => ids[index] === id);
}

/** Complete absence is valid for unrelated registries; partial seasonal leaf ownership is never usable. */
export function validateSeasonalGround(bundles: readonly ArtBundle[]): readonly ArtSchemaIssue[] {
  const entries = bundles.flatMap(bundle => bundle.entries);
  const seasonal = entries.filter(isSeasonalGroundEntry);
  const rules = bundles.flatMap(bundle => bundle.rules).filter(isLeafReference);
  if (seasonal.length === 0 && rules.length === 0) return [];
  const issues: ArtSchemaIssue[] = [];
  const issue = (path: string, message: string): void => { issues.push({ path, message }); };
  const seasonalIds = seasonal.map(entry => entry.id).sort();
  if (!sameIds(seasonalIds)) issue('$/seasonal-ground/entries', 'Seasonal leaves require the complete old3 entry family only');
  for (const entry of seasonal) {
    const at = `$/entries/${entry.id}`;
    const sha = expectedSha.get(entry.id);
    if (entry.season !== 'autumn') issue(at, 'Seasonal leaves are autumn-only');
    if (entry.image.width !== 96 || entry.image.height !== 48 || entry.image.url !== expectedUrls.get(entry.id)) issue(at, 'Seasonal leaf image metadata differs from old3');
    if (entry.provenance.inboxFile !== expectedInbox.get(entry.id) || entry.provenance.sourceSha256 !== sha || entry.provenance.runtimeSha256 !== sha) issue(at, 'Seasonal leaf provenance differs from pinned old3 source/runtime');
    if (entry.geometry.pivot.x !== 48 || entry.geometry.pivot.y !== 46 || entry.geometry.scale !== 0.5 || entry.geometry.allowMirror !== false || entry.geometry.crop !== undefined || entry.geometry.footprint !== undefined) issue(at, 'Seasonal leaf geometry requires full native canvas, pivot 48,46, scale .5, no footprint');
  }
  if (rules.length !== 1) issue('$/seasonal-ground/rules', 'Seasonal leaves require exactly one owning rule');
  const rule = rules[0];
  if (rule !== undefined) {
    if (rule.kind !== 'ground-prop' || rule.slot !== SEASONAL_GROUND_SLOT || rule.priority !== 0 || rule.fallback !== 'none') issue(`$/rules/${rule.id}`, 'Seasonal leaf rule requires ground-prop seasonal-leaves priority zero fallback none');
    if (rule.conditions.length !== 2 || !rule.conditions.some(c => conditionMatches(c, 'season', 'autumn')) || !rule.conditions.some(c => conditionMatches(c, 'placement', SEASONAL_GROUND_PLACEMENT))) issue(`$/rules/${rule.id}`, 'Seasonal leaf rule requires exact autumn seasonal-ground conditions');
    if (!sameIds(rule.variants.map(variant => variant.assetId)) || rule.variants.some(variant => variant.weight !== 1)) issue(`$/rules/${rule.id}`, 'Seasonal leaf variants require leaves_a,b,c order with unit weights');
  }
  for (const entry of entries) if (entry.kind === 'ground-prop' && SEASONAL_LEAF_IDS.some(id => id === entry.id) && entry.placement !== SEASONAL_GROUND_PLACEMENT) issue(`$/entries/${entry.id}`, 'Reserved seasonal leaf ID has wrong placement');
  return issues;
}
