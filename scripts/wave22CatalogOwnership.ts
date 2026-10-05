import { readFileSync } from 'node:fs';
import { isRegionTexture } from '../src/render/art/artContract';
import { REGION_BASES } from '../src/render/art/regionTextureValidation';
import { createArtRegistry } from '../src/render/art/artRegistry';

const filename = process.argv[2];
if (filename === undefined) throw new Error('Usage: tsx scripts/wave22CatalogOwnership.ts CATALOG');
const bundles: unknown = JSON.parse(readFileSync(filename, 'utf8'));
if (!Array.isArray(bundles)) throw new Error('Catalog must be a bundle array');
const registry = createArtRegistry(bundles);
const owned = new Set(registry.entries('ground-prop').flatMap(entry => entry.kind === 'ground-prop' && entry.placement === 'land' ? [entry.baseId] : []));
if (registry.entries('ground-texture').some(isRegionTexture)) {
  for (const baseId of REGION_BASES) for (const season of ['summer', 'autumn', 'winter'] as const) for (const role of ['a', 'b'] as const) {
    const entry = registry.select('ground-texture', `land-region-base-${role}`, { baseId, season }, 0);
    const key = `terrain/${baseId}_${season}_${role}`;
    if (entry === null || !isRegionTexture(entry) || entry.image.url !== `assets/wave22/${key}.png`)
      throw new Error(`Canonical region ownership must preserve source registration for ${key}`);
    owned.add(key);
  }
}
console.log(JSON.stringify([...owned].sort()));
