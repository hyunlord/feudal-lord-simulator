import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import { parseWorldAssetManifest } from '../scripts/worldAssetManifest';

it('parses native alpha only with traceable accepted source', () => {
  const raw: unknown = JSON.parse(readFileSync('public/assets/world_asset_manifest.json','utf8'));
  const manifest = parseWorldAssetManifest(raw);
  assert.equal(manifest.assets.find(a => a.key === 'house_l0')?.alphaPolicy, 'transparent-native-alpha');
});

it('rejects native alpha assigned to a legacy generation source', () => {
  const manifest = parseWorldAssetManifest(JSON.parse(readFileSync('public/assets/world_asset_manifest.json','utf8')));
  const invalid = { ...manifest, assets: manifest.assets.map(asset => asset.key === 'house_l0' ? { ...asset, source: { seed: 1, candidate: 1 } } : asset) };
  assert.throws(() => parseWorldAssetManifest(invalid), /alphaPolicy must be transparent-outline-179/);
});

it('rejects accepted art that fabricates legacy generation metadata', () => {
  const manifest = parseWorldAssetManifest(JSON.parse(readFileSync('public/assets/world_asset_manifest.json','utf8')));
  const invalid = { ...manifest, assets: manifest.assets.map(asset => asset.key === 'house_l0' ? { ...asset, source: { ...asset.source, seed: 1 } } : asset) };
  assert.throws(() => parseWorldAssetManifest(invalid), /must not invent legacy generation metadata/);
});

it('rejects an accepted source whose SHA was tampered with', async () => {
  const { assertWorldAssetFiles } = await import('../scripts/worldAssetManifest');
  const manifest = parseWorldAssetManifest(JSON.parse(readFileSync('public/assets/world_asset_manifest.json','utf8')));
  const invalid = { ...manifest, assets: manifest.assets.map(asset => asset.key === 'house_l0' && asset.source.kind === 'accepted-art' ? { ...asset, source: { ...asset.source, sha256: '0'.repeat(64) } } : asset) };
  assert.throws(() => assertWorldAssetFiles(invalid, process.cwd()), /accepted source hash mismatch/);
});

it('rejects washed-out native alpha while allowing opaque content with soft edges', async () => {
  const { assertNativeAlphaSprite } = await import('../scripts/acceptedArtVerification');
  const manifest = parseWorldAssetManifest(JSON.parse(readFileSync('public/assets/world_asset_manifest.json','utf8')));
  const asset = manifest.assets.find(entry => entry.key === 'house_l0');
  assert.ok(asset);
  const dimensions = { width: 8, height: 8 };
  const rgba = new Uint8Array(8 * 8 * 4);
  for (let y = 2; y < 6; y += 1) for (let x = 2; x < 6; x += 1) rgba[(y * 8 + x) * 4 + 3] = 5;
  assert.throws(() => assertNativeAlphaSprite({ dimensions, rgba }, asset), /excessively translucent/);
  for (let y = 2; y < 6; y += 1) for (let x = 2; x < 6; x += 1) rgba[(y * 8 + x) * 4 + 3] = x === 2 ? 64 : 255;
  assert.doesNotThrow(() => assertNativeAlphaSprite({ dimensions, rgba }, asset));
});
