import { readFileSync } from 'node:fs';
import { createArtRegistry } from '../src/render/art/artRegistry';

const filename = process.argv[2];
if (filename === undefined) throw new Error('Usage: tsx scripts/wave22CatalogOwnership.ts CATALOG');
const bundles: unknown = JSON.parse(readFileSync(filename, 'utf8'));
if (!Array.isArray(bundles)) throw new Error('Catalog must be a bundle array');
const registry = createArtRegistry(bundles);
console.log(JSON.stringify([...new Set(registry.entries('ground-prop').flatMap(entry => entry.kind === 'ground-prop' && entry.placement === 'land' ? [entry.baseId] : []))].sort()));
