import { validateNature } from './natureValidation';
import { validateWeatherShadows } from './weatherShadowValidation';
import { validateSeasonalGround } from './seasonalGroundValidation';
import { validateRegionTextures } from './regionTextureValidation';
import { validateLandDecals } from './landDecalValidation';
import { validateFieldTextures } from './fieldTextureValidation';
import { validateSeasonVariants } from './seasonVariantValidation';
import type { ArtBundle, ArtPoint, ArtRect } from './artContract';
import type { ArtSchemaIssue } from './schemaValidation';

/** Semantic checks require the complete bundle set so references can cross bundle boundaries. */
export function validateRegistryData(bundles: readonly ArtBundle[]): readonly ArtSchemaIssue[] {
  const issues: ArtSchemaIssue[] = [...validateNature(bundles), ...validateSeasonVariants(bundles), ...validateFieldTextures(bundles), ...validateLandDecals(bundles), ...validateSeasonalGround(bundles), ...validateRegionTextures(bundles), ...validateWeatherShadows(bundles)];
  const identities = new Set<string>();
  const entries = bundles.flatMap(bundle => bundle.entries);
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const report = (path: string, message: string): void => { issues.push({ path, message }); };
  const identity = (id: string, path: string): void => {
    if (identities.has(id)) report(path, `Duplicate identifier ${id}`);
    identities.add(id);
  };
  const pointFits = (point: ArtPoint, size: { readonly width: number; readonly height: number }): boolean => point.x >= 0 && point.y >= 0 && point.x <= size.width && point.y <= size.height;
  const rectFits = (rect: ArtRect, size: { readonly width: number; readonly height: number }): boolean => rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= size.width && rect.y + rect.height <= size.height;
  for (const bundle of bundles) {
    identity(bundle.bundleId, `$/bundles/${bundle.bundleId}`);
    for (const entry of bundle.entries) identity(entry.id, `$/entries/${entry.id}`);
    for (const rule of bundle.rules) {
      identity(rule.id, `$/rules/${rule.id}`);
      for (const variant of rule.variants) {
        const entry = byId.get(variant.assetId);
        if (!entry || entry.kind !== rule.kind) report(`$/rules/${rule.id}`, `Missing or kind-inconsistent variant ${variant.assetId}`);
      }
    }
  }
  for (const entry of entries) {
    const at = `$/entries/${entry.id}`;
    const scale = 'geometry' in entry ? entry.geometry.scale : entry.kind === 'walker-cargo' ? entry.scale : 1;
    const finiteScaled = (coordinates: readonly number[]): boolean => coordinates.every(value => Number.isFinite(value * scale));
    if (!finiteScaled([entry.image.width, entry.image.height])) report(at, 'Scaled image canvas overflows');
    if ('geometry' in entry) {
      if (!pointFits(entry.geometry.pivot, entry.image)) report(at, 'Pivot is outside image canvas');
      if ('crop' in entry.geometry && entry.geometry.crop && !rectFits(entry.geometry.crop, entry.image)) report(at, 'Crop is outside image canvas');
      if (!finiteScaled(Object.values(entry.geometry.pivot))) report(at, 'Scaled image pivot overflows');
      if ('crop' in entry.geometry && entry.geometry.crop && !finiteScaled(Object.values(entry.geometry.crop))) report(at, 'Scaled crop overflows');
    }
    if ('frames' in entry && entry.frames && !Number.isFinite(entry.frames.reduce((sum, frame) => sum + frame.durationMs, 0))) report(at, 'Animation loop duration overflows');
    if ('frames' in entry && entry.frames) for (const frame of entry.frames) {
      if (!rectFits(frame.sourceRect, entry.image)) report(at, 'Frame is outside image canvas');
      if (!pointFits(frame.pivot, frame.sourceRect)) report(at, 'Frame pivot is outside frame-local bounds');
      if (!finiteScaled([...Object.values(frame.sourceRect), ...Object.values(frame.pivot)])) report(at, 'Scaled frame geometry overflows');
    }
    if (entry.kind === 'walker-cargo' && entry.frames.some(frame => !pointFits(entry.attachment.pivot, frame.sourceRect))) report(at, 'Attachment pivot is outside frame-local bounds');
    if (entry.kind === 'walker-cargo' && !finiteScaled(Object.values(entry.attachment.pivot))) report(at, 'Scaled attachment pivot overflows');
    if (entry.kind === 'land-stage' && entry.ports) {
      for (const point of Object.values(entry.ports)) {
        if (!pointFits(point, entry.image)) report(at, 'Port is outside image canvas');
        if (!finiteScaled(Object.values(point))) report(at, 'Scaled port overflows');
      }
    }
    if (entry.kind === 'ground-prop' && entry.placement !== 'stock-pile' && entry.placement !== 'land' && entry.placement !== 'seasonal-ground' && entry.placement !== 'nature-ground' && entry.placement !== 'spring-context' && entry.wealthRange && entry.wealthRange.min !== undefined && entry.wealthRange.max !== undefined && entry.wealthRange.min >= entry.wealthRange.max) report(at, 'Wealth range requires min < max');
    if (entry.kind === 'building-attachment') {
      const mountedBodies = new Set<string>();
      for (const mount of entry.mounts) {
        if (mountedBodies.has(mount.bodyId)) report(at, `Duplicate attachment mount for ${mount.bodyId}`);
        mountedBodies.add(mount.bodyId);
        const body = byId.get(mount.bodyId);
        if (!body || (body.kind !== 'building-body' && body.kind !== 'landmark')) {
          report(at, `Missing body or landmark mount target ${mount.bodyId}`); continue;
        }
        const crop = body.geometry.crop ?? { x: 0, y: 0, width: body.image.width, height: body.image.height };
        if (!pointFits(mount.point, body.image) || mount.point.x < crop.x || mount.point.y < crop.y
          || mount.point.x > crop.x + crop.width || mount.point.y > crop.y + crop.height) report(at, `Attachment mount is outside target crop ${mount.bodyId}`);
        if (!Object.values(mount.point).every(value => Number.isFinite(value * body.geometry.scale))) report(at, 'Scaled attachment mount overflows');
      }
    }
    if (entry.kind === 'state-overlay') for (const id of entry.targetBodyIds) {
      const body = byId.get(id);
      if (!body || (body.kind !== 'building-body' && body.kind !== 'landmark')) { report(at, `Missing body or landmark target ${id}`); continue; }
      if (body.image.width !== entry.image.width || body.image.height !== entry.image.height || body.geometry.scale !== entry.geometry.scale || body.geometry.pivot.x !== entry.geometry.pivot.x || body.geometry.pivot.y !== entry.geometry.pivot.y) report(at, `Overlay canvas/pivot/scale differs from ${id}`);
      const bodyCrop = body.geometry.crop ?? { x: 0, y: 0, width: body.image.width, height: body.image.height };
      const overlayCrop = entry.geometry.crop ?? { x: 0, y: 0, width: entry.image.width, height: entry.image.height };
      if (bodyCrop.x !== overlayCrop.x || bodyCrop.y !== overlayCrop.y || bodyCrop.width !== overlayCrop.width || bodyCrop.height !== overlayCrop.height) report(at, `Overlay crop differs from ${id}`);
    }
    if (entry.kind === 'portrait') {
      const sizes = new Set<number>();
      for (const derivative of entry.derivatives) {
        const asset = byId.get(derivative.assetId);
        if (!asset || asset.kind !== 'portrait' || asset.image.width !== derivative.size || asset.image.height !== derivative.size) report(at, `Invalid portrait derivative ${derivative.assetId}`);
        if (sizes.has(derivative.size)) report(at, 'Duplicate portrait derivative size');
        sizes.add(derivative.size);
      }
    }
    if (entry.kind === 'regional-map') {
      const slots = new Set<string>();
      for (const slot of entry.slots) {
        if (!pointFits(slot, entry.coordinateSpace)) report(at, `Map slot ${slot.id} is outside coordinate space`);
        if (!entry.landTypes.includes(slot.landType)) report(at, `Map slot ${slot.id} uses undeclared land type`);
        if (slots.has(slot.id)) report(at, `Duplicate map slot ${slot.id}`);
        slots.add(slot.id);
      }
    }
  }
  return issues;
}
