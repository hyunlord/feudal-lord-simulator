// RB-WET-PATHS runtime/catalog installation only. Provenance ledger publication follows actual scene QA.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalogFile = `${root}src/render/art/catalog.json`;
const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
const legacy = catalog.find(bundle => bundle.bundleId === 'wave42');
assert.ok(legacy);
const hashes = {
  ne: '799ccd46ae92650f033240863227db1aab519afeac6cb266ec72641f1d85643d',
  nw: '463aee24fdb0247e576c5bf9aafc065e159de9cc00473882e085ce9cebaba2f8',
};
const entries = [], rules = [];
for (const [axis, digest] of Object.entries(hashes)) {
  const id = `path_muddy_${axis}_summer`;
  const source = `assets-inbox/wave42/candidates-20261002/assets/paths/${id}.png`;
  const url = `assets/wave42/paths/${id}.png`;
  const bytes = readFileSync(`${root}${source}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
  assert.equal(bytes.readUInt32BE(16), 512);
  assert.equal(bytes.readUInt32BE(20), 64);
  for (let offset = 8; offset < bytes.length; offset += bytes.readUInt32BE(offset) + 12) {
    assert.ok(!['caBX', 'jumb', 'c2pa'].includes(bytes.toString('ascii', offset + 4, offset + 8)));
  }
  const clear = legacy.entries.find(entry => entry.id === `path_clear_${axis}_summer`);
  const clearRule = legacy.rules.find(rule => rule.id === `path-strip-${axis}-summer`);
  assert.ok(clear && clearRule);
  entries.push({ ...clear, id, image: { ...clear.image, url },
    provenance: { inboxFile: source, sourceSha256: digest, runtimeSha256: digest }, family: 'wet-path', stage: `path_muddy_${axis}` });
  rules.push({ ...clearRule, id: `wet-path-strip-${axis}-summer`, slot: 'wet-path-strip',
    conditions: clearRule.conditions.map(condition => condition.field === 'family' ? { ...condition, value: 'wet-path' } : condition),
    variants: [{ assetId: id, weight: 1 }] });
  copyFileSync(`${root}${source}`, `${root}public/${url}`);
  assert.deepEqual(readFileSync(`${root}public/${url}`), bytes);
}
const bundle = { schemaVersion: 1, bundleId: 'wet-paths', entries, rules };
const prior = catalog.findIndex(item => item.bundleId === bundle.bundleId);
if (prior === -1) catalog.push(bundle); else catalog[prior] = bundle;
writeFileSync(catalogFile, `${JSON.stringify(catalog, null, 2)}\n`);
console.log('RB-WET-PATHS: two byte-identical warm-season strips; winter and bookkeeping untouched');
