import type { ArtBundle } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';
import { spriteMetaView } from '../worldAssets';
import { ZONE_ASSETS } from '../zoneAssetManifest';

/** Resolve the real registration once at startup, before publishing a registry. */
export function validateSeasonVariants(bundles: readonly ArtBundle[]): readonly ArtSchemaIssue[] {
  const issues: ArtSchemaIssue[] = [];
  const entries = bundles.flatMap(bundle => bundle.entries);
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  for (const entry of entries) {
    if (entry.kind !== 'season-variant') continue;
    const path = `$/entries/${entry.id}`;
    const world = spriteMetaView(entry.base.key);
    const zone = ZONE_ASSETS.find(meta => meta.key === entry.base.key && meta.role === 'prop');
    if (world !== null && zone !== undefined) issues.push({ path, message: 'Ambiguous season base namespace' });
    const base = entry.base.namespace === 'world-sprite'
      ? world === null ? null : { width: world.width, height: world.height, pivot: world.anchor, scale: world.renderScale }
      : zone === undefined || !('displayWidth' in zone) ? null : { width: zone.width, height: zone.height, pivot: { x: zone.anchorX, y: zone.anchorY }, scale: zone.displayWidth / zone.width };
    if (base === null) { issues.push({ path, message: 'Unknown season base registration' }); continue; }
    if (base.width !== entry.image.width || base.height !== entry.image.height || base.pivot.x !== entry.geometry.pivot.x || base.pivot.y !== entry.geometry.pivot.y || base.scale !== entry.geometry.scale)
      issues.push({ path, message: 'Season canvas/pivot/scale differs from base registration' });
  }
  for (const rule of bundles.flatMap(bundle => bundle.rules)) {
    if (rule.kind !== 'season-variant') continue;
    const path = `$/rules/${rule.id}`;
    const base = rule.conditions.find(condition => condition.field === 'baseKey');
    const season = rule.conditions.find(condition => condition.field === 'season');
    if (rule.slot !== 'season-replacement' || rule.priority !== 0 || rule.conditions.length !== 2 || base?.op !== 'eq' || season?.op !== 'eq') {
      issues.push({ path, message: 'Season rule requires slot, priority zero, and exact baseKey/season equality' }); continue;
    }
    for (const variant of rule.variants) {
      const entry = byId.get(variant.assetId);
      if (entry?.kind !== 'season-variant' || entry.base.key !== base.value || entry.season !== season.value || variant.weight !== 1)
        issues.push({ path, message: 'Season variant base/season or unit weight mismatch' });
    }
    if (rule.variants.some((variant, index) => index > 0 && (rule.variants[index - 1]?.assetId ?? '') >= variant.assetId))
      issues.push({ path, message: 'Season variants require lexical ID order' });
  }
  return issues;
}
