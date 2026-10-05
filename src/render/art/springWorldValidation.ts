import type { ArtBundle, ArtEntry, SpringWorldEntry, SpringWorldRole } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';

export const SPRING_WORLD_ROLES = ['riverside-grass', 'cherry', 'ewe-lamb', 'hawthorn', 'laundry', 'nest', 'swollen-bank'] as const;
const geometry = [
  ['riverside_grass_spring_a', 'riverside-grass', 256, 128, 0, 0, 0.5],
  ['orchard_cherry_spring', 'cherry', 256, 256, 128, 242, 43 / 256],
  ['ewe_lamb_a_spring', 'ewe-lamb', 128, 96, 67, 69, 23 / 128],
  ['ewe_lamb_b_spring', 'ewe-lamb', 128, 96, 65, 77, 23 / 128],
  ['hawthorn_blossom_strip_spring', 'hawthorn', 512, 64, 256, 53, 0.5],
  ['laundry_yard_spring', 'laundry', 256, 192, 132, 176, 27.5 / 256],
  ['nest_bird_spring', 'nest', 128, 96, 65, 79, 9 / 128],
  ['swollen_stream_bank_spring', 'swollen-bank', 256, 128, 130, 117, 0.5],
] as const;
export function isSpringWorldEntry(entry: ArtEntry | null): entry is SpringWorldEntry {
  return entry?.kind === 'ground-prop' && entry.placement === 'spring-context';
}
export function springWorldSlot(role: SpringWorldRole): string { return `spring-${role}`; }

/** A missing family falls back; a partial or altered family cannot publish a registry snapshot. */
export function validateSpringWorld(bundles: readonly ArtBundle[]): readonly ArtSchemaIssue[] {
  const allEntries = bundles.flatMap(bundle => bundle.entries);
  const reserved = new Set<string>(geometry.map(([id]) => `wave43:${id}`));
  const entries = allEntries.filter(isSpringWorldEntry);
  const rules = bundles.flatMap(bundle => bundle.rules).filter(rule => rule.slot.startsWith('spring-') || rule.variants.some(variant => reserved.has(variant.assetId)));
  if (entries.length === 0 && rules.length === 0 && !allEntries.some(entry => reserved.has(entry.id))) return [];
  const issues: ArtSchemaIssue[] = [];
  const issue = (path: string, message: string): void => { issues.push({ path, message }); };
  if (entries.length !== geometry.length) issue('$/spring-context', 'Spring context requires the complete eight-entry family');
  for (const [id, role, width, height, x, y, scale] of geometry) {
    const entry = entries.find(entry => entry.id === `wave43:${id}`);
    if (!entry) { issue(`$/entries/wave43:${id}`, 'Missing spring family member'); continue; }
    const at = `$/entries/${entry.id}`;
    if (entry.role !== role || entry.season !== 'spring' || entry.group !== 'all' || entry.minZoom !== (role === 'nest' ? 1 : 0.6) || entry.opacity !== 1) issue(at, 'Spring role, season, group or visibility differs from approved policy');
    if (entry.image.width !== width || entry.image.height !== height || entry.geometry.pivot.x !== x || entry.geometry.pivot.y !== y || entry.geometry.scale !== scale || entry.geometry.allowMirror !== false || entry.geometry.crop !== undefined || entry.geometry.footprint !== undefined) issue(at, 'Spring geometry requires native full canvas, source pivot and uniform approved scale');
    const folder = role === 'cherry' ? 'orchard' : role === 'riverside-grass' ? 'ground' : 'props';
    const filename = `${id}${role === 'riverside-grass' ? '-v1' : ''}.png`;
    if (entry.image.url !== `assets/wave43/${folder}/${filename}` || entry.provenance.inboxFile !== `assets-inbox/wave43/candidates-20261002/assets/${folder}/${filename}`) issue(at, 'Spring source and runtime paths must preserve identity');
  }
  if (rules.length !== SPRING_WORLD_ROLES.length) issue('$/spring-context/rules', 'Spring family requires exactly seven owning rules');
  for (const role of SPRING_WORLD_ROLES) {
    const matching = rules.filter(rule => rule.slot === springWorldSlot(role));
    const rule = matching[0];
    if (matching.length !== 1 || !rule) { issue(`$/spring-context/${role}`, 'Role requires one owning rule'); continue; }
    const at = `$/rules/${rule.id}`;
    const expected = { season: 'spring', placement: 'spring-context', role, group: 'all' };
    if (rule.kind !== 'ground-prop' || rule.priority !== 0 || rule.fallback !== 'none' || rule.conditions.length !== 4 || !Object.entries(expected).every(([field, value]) => rule.conditions.some(condition => condition.op === 'eq' && condition.field === field && condition.value === value))) issue(at, 'Spring rule requires exact role/group and spring-context predicates');
    const ids = geometry.filter(item => item[1] === role).map(([id]) => `wave43:${id}`);
    if (rule.variants.length !== ids.length || rule.variants.some((variant, index) => variant.assetId !== ids[index] || variant.weight !== 1)) issue(at, 'Spring rule must own complete ordered static role variants');
  }
  return issues;
}
