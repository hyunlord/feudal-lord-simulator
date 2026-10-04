import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import baseline from './fixtures/season-art-before.json';
import bundle from './fixtures/season-variant-migration.json';
import { createSeasonVariantArt, mergeSeasonImages } from '../src/render/art/seasonVariantArt';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { LEGACY_SEASON_IMAGES, SEASON_IMAGES } from '../src/render/seasonArtManifest.generated';
import { seasonVariant, seasonVariants } from '../src/render/seasonArt';

const registry = createArtRegistry([bundle]);
const historical = createSeasonVariantArt(registry);
const entries = historical.entries;
const first = entries[0];
assert.ok(first?.kind === 'season-variant');

test('migration preserves twenty originals and forty-five legacy files', () => {
  assert.equal(entries.length, 20); assert.equal(Object.keys(LEGACY_SEASON_IMAGES).length, 45);
  const migrated = { ...historical.images, ...LEGACY_SEASON_IMAGES };
  assert.equal(Object.keys(migrated).length, 65);
  const expected: Readonly<Record<string, { readonly url: string; readonly width: number; readonly height: number }>> = baseline;
  assert.deepEqual(Object.keys(migrated).sort(), Object.keys(expected).sort());
  for (const [key, meta] of Object.entries(migrated)) {
    const prior = expected[key]; assert.ok(prior);
    assert.equal(meta.url, prior.url); assert.equal(meta.width, prior.width); assert.equal(meta.height, prior.height);
  }
});
test('all base-season-salt choices retain lexical abs/trunc selection', () => {
  const before: Readonly<Record<string, { readonly url: string; readonly bases?: readonly string[]; readonly season?: string }>> = baseline;
  const names = ['spring', 'summer', 'autumn', 'winter'];
  for (const entry of entries) {
    assert.equal(entry.kind, 'season-variant');
    if (entry.kind !== 'season-variant') continue;
    for (const season of [0, 1, 2, 3] as const) {
      const choices: string[] = Object.keys(before).sort().filter(key => before[key]?.bases?.includes(entry.base.key) && before[key]?.season?.replace('_snow', '') === names[season]);
      for (const salt of [-3, -2, -1, -0.8, 0, 0.8, 1, 2, 3, Number.MAX_SAFE_INTEGER])
        assert.equal(historical.select(entry.base.key, season, salt), choices[Math.abs(Math.trunc(salt)) % choices.length] ?? null);
      for (const salt of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(historical.select(entry.base.key, season, salt), null);
    }
  }
  assert.equal(seasonVariant('unknown', 0), null);
  assert.equal(new Set([0, 1, 2, 3].flatMap(season => seasonVariants(season as 0 | 1 | 2 | 3))).size, Object.values(SEASON_IMAGES).filter(meta => 'bases' in meta).length);
  for (const entry of ART_REGISTRY.entries('season-variant')) {
    if (entry.kind !== 'season-variant') continue;
    assert.ok(seasonVariants(names.indexOf(entry.season) as 0 | 1 | 2 | 3).includes(entry.id));
  }
});
test('startup rejects fictional registration, mismatched geometry, and unsupported fields', () => {
  const variants = [
    { ...first, base: { ...first.base, key: 'absent' } },
    { ...first, base: { ...first.base, namespace: 'imagined' } },
    { ...first, image: { ...first.image, width: first.image.width + 1 } },
    { ...first, geometry: { ...first.geometry, scale: first.geometry.scale + 1 } },
    { ...first, geometry: { ...first.geometry, pivot: { x: 0, y: 0 } } },
    { ...first, geometry: { ...first.geometry, allowMirror: true } },
    { ...first, geometry: { ...first.geometry, crop: { x: 0, y: 0, width: 1, height: 1 } } },
    { ...first, season: 'winter_snow' }, { ...first, growthStage: 'fake' },
  ];
  for (const entry of variants) assert.throws(() => createArtRegistry([{ schemaVersion: 1, bundleId: 'invalid', entries: [entry], rules: [] }]));
});
test('season rules require exact base/season, unit weights, lexical ordering and dedicated slot', () => {
  const rule = bundle.rules[0]; assert.ok(rule);
  for (const replacement of [
    { ...rule, slot: 'generic' }, { ...rule, priority: 1 }, { ...rule, conditions: [] },
    { ...rule, conditions: [{ op: 'eq', field: 'baseKey', value: 'absent' }, { op: 'eq', field: 'season', value: 'spring' }] },
    { ...rule, variants: rule.variants.map(variant => ({ ...variant, weight: 2 })) },
  ]) assert.throws(() => createArtRegistry([{ ...bundle, rules: [replacement] }]));
});
test('pure installer output retains ownership when active spring entries are replaced', () => {
  const result = execFileSync('python3', ['-c', [
    'import importlib.util,json,pathlib',
    'spec=importlib.util.spec_from_file_location("installer","scripts/installWave15.py")',
    'm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)',
    'images=json.loads(pathlib.Path("tests/fixtures/season-art-before.json").read_text())',
    'print(m.legacy_manifest_source(images),end="")',
  ].join(';')], { encoding: 'utf8' });
  assert.equal(result, readFileSync('src/render/seasonArtManifest.generated.ts', 'utf8'));
  assert.ok(!result.includes('  tree_oak_large_spring:'));
  assert.ok(result.includes('seasonVariantArt'));
});

test('raw legacy keys cannot shadow contract IDs at startup', () => {
  const active = ART_REGISTRY.entries('season-variant')[0]; assert.ok(active);
  assert.throws(() => mergeSeasonImages({ [active.id]: active.image }), /Duplicate legacy/);
});
