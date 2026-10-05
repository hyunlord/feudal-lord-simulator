import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PRESSURE_BALANCE } from '../src/content/balanceConfig';
import { GROWN_YEARS, STUMP_YEARS, FALLOW_SCRUB_YEARS, FALLOW_SAPLING_YEARS } from '../src/content/landConfig';
import { cellHash, fallowPicture, nextTreePictureTick, stageSeason, treeStagePicture, TREE_PICTURE_TURNS } from '../src/render/landStageModel';
import { WAVE42_STAGES } from '../src/render/wave42StageManifest.generated';
import { FOOTPATH_RULES, PORTS, footpathRule, portsKey, parseFootpathLayouts } from '../src/render/footpathModel';
import layouts from '../src/render/art/bundles/footpath-layouts.json';
import catalog from '../src/render/art/catalog.json';
import { createArtRegistry, ArtRegistryError } from '../src/render/art/artRegistry';
import { ART_REGISTRY, selectLandArt } from '../src/render/art/wave42Registry';

const validatedCatalog = catalog.map(bundle => ({ ...bundle, entries: bundle.entries.map(entry => {
  const validated = ART_REGISTRY.entry(entry.id);
  assert.ok(validated);
  return validated;
}) }));

const YEAR = 4 * PRESSURE_BALANCE.seasonTicks;
const turns = [YEAR, STUMP_YEARS * YEAR, ((STUMP_YEARS + GROWN_YEARS) / 2) * YEAR, GROWN_YEARS * YEAR];
const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

test('preserves all 36 metadata records exactly against the pre-migration digest', () => {
  assert.equal(Object.keys(WAVE42_STAGES).length, 36);
  assert.equal(sha(JSON.stringify(WAVE42_STAGES)), '7ab86a324afd0de32925e50434e71b4def579aed70f97777f5996225439c0db3');
});

test('records independently verified source and runtime hashes for every migrated image', () => {
  const entries = ART_REGISTRY.entries('land-stage');
  assert.equal(entries.length, 36);
  for (const entry of entries) {
    assert.equal(sha(readFileSync(entry.provenance.inboxFile)), entry.provenance.sourceSha256, entry.id);
    assert.equal(sha(readFileSync(`public/${entry.image.url}`)), entry.provenance.runtimeSha256, entry.id);
  }
});

test('preserves tree images and next invalidation at both parities and every boundary ±1 tick', () => {
  assert.deepEqual(TREE_PICTURE_TURNS, turns);
  for (const tx of [0, 1, 2, 3, 4, 5, 6, 7]) {
    const harvest = { tx, ty: 7, harvestedAtTick: 137 };
    const odd = cellHash(tx, 7) % 2 === 1;
    for (const age of [-1, 0, ...turns.flatMap(turn => [turn - 1, turn, turn + 1]), 8 * YEAR]) {
      const expected = age < STUMP_YEARS * YEAR
        ? `stump_${odd ? 'ash_small' : 'oak_large'}_${age < YEAR ? 'fresh' : 'mossy'}`
        : age < GROWN_YEARS * YEAR ? (age < ((STUMP_YEARS + GROWN_YEARS) / 2) * YEAR ? 'sapling_1to3' : 'sapling_4to8') : `young_wood_${odd ? 'b' : 'a'}`;
      assert.equal(treeStagePicture(harvest, harvest.harvestedAtTick + age), expected);
      const next = turns.find(turn => turn > age);
      assert.equal(nextTreePictureTick(harvest, harvest.harvestedAtTick + age), next === undefined ? Infinity : harvest.harvestedAtTick + next);
    }
  }
});

test('preserves fallow plot/field choices around each engine stage boundary', () => {
  for (const plot of [false, true]) {
    for (const age of [-1, 0, ...[FALLOW_SCRUB_YEARS * YEAR, FALLOW_SAPLING_YEARS * YEAR].flatMap(turn => [turn - 1, turn, turn + 1])]) {
      const expected = age < FALLOW_SCRUB_YEARS * YEAR ? (plot ? 'abandoned_grass' : 'abandoned_overgrown_furrows')
        : age < FALLOW_SAPLING_YEARS * YEAR ? 'abandoned_bramble' : 'abandoned_saplings';
      assert.equal(fallowPicture(plot, 123, 123 + age), expected);
    }
  }
});

test('season rules select both seasonal files from all four engine seasons', () => {
  for (const [index, season] of ['spring', 'summer', 'autumn', 'winter'].entries()) {
    for (const parity of [0, 1]) {
      const selected = selectLandArt('tree', { family: 'tree', stage: 'stump', ageYears: 0, parity, season });
      assert.equal(selected.id, `stump_${parity === 1 ? 'ash_small' : 'oak_large'}_fresh_${index === 3 ? 'winter' : 'summer'}`);
    }
  }
  assert.deepEqual(([0, 1, 2, 3] as const).map(stageSeason), ['summer', 'summer', 'summer', 'winter']);
});

test('preserves all 16 connection masks and their exact strip halves', () => {
  assert.equal(Object.keys(FOOTPATH_RULES).length, 16);
  assert.equal(sha(JSON.stringify(FOOTPATH_RULES)), 'f2e6ce46f95bd5977ba517c03fe09cb16b2dc88b878f4a1590ce1f34391a2c8b');
  for (let mask = 0; mask < 16; mask += 1) {
    const ports = PORTS.filter((_, bit) => (mask & (1 << bit)) !== 0);
    const rule = footpathRule(ports);
    assert.equal(rule, FOOTPATH_RULES[portsKey(ports)]);
    if (rule.connector === null && rule.shape !== 'dot') assert.deepEqual(rule.halves, ports);
    if (rule.connector !== null) {
      for (const season of ['summer', 'winter']) {
        const entry = selectLandArt('path', { family: 'path', stage: rule.connector, season });
        assert.deepEqual(Object.keys(entry.ports ?? {}).sort(), [...ports].sort());
      }
    }
  }
});


test('rejects malformed, incomplete and duplicate topology data atomically', () => {
  for (const invalid of [layouts.slice(1), layouts.map(row => ({ ...row, surprise: true })), layouts.map(() => layouts[0])]) {
    assert.throws(() => parseFootpathLayouts(invalid), ArtRegistryError);
  }
});

test('new authored visual thresholds change selection and invalidation together', () => {
  const changed = validatedCatalog.map(bundle => ({ ...bundle, rules: bundle.rules.map(rule => ({
    ...rule, conditions: rule.conditions.map(condition => condition.op === 'range' && condition.field === 'stageProgress'
      ? { ...condition, ...('min' in condition ? { min: 0.25 } : {}), ...('max' in condition ? { max: 0.25 } : {}) } : condition),
  })) }));
  const registry = createArtRegistry(changed);
  const context = { family: 'tree', stage: 'sapling', season: 'summer', ageYears: 3, stageProgress: 0.3, parity: 0 };
  assert.equal(ART_REGISTRY.select('land-stage', 'tree', context, 0)?.id, 'sapling_1to3_summer');
  assert.equal(registry.select('land-stage', 'tree', context, 0)?.id, 'sapling_4to8_summer');
  assert.deepEqual(registry.boundaries('land-stage', 'tree', 'stageProgress'), [0.25]);
  assert.equal(registry.nextChange('land-stage', 'tree', { ...context, stageProgress: 0.1 }, 'stageProgress'), 0.25);
});

test('connector stage names are authored data rather than a renderer enum', () => {
  const previous = 'path_clear_corner_ne';
  const renamed = 'new-corner-family';
  const registry = createArtRegistry(validatedCatalog.map(bundle => ({ ...bundle,
    entries: bundle.entries.map(entry => entry.kind === 'land-stage' && entry.stage === previous ? { ...entry, stage: renamed } : entry),
  })));
  const changed = layouts.map(row => ({ ...row, connector: row.connector === previous ? renamed : row.connector }));
  const parsed = parseFootpathLayouts(changed, registry);
  assert.equal(parsed['SW+NW']?.connector, renamed);
});

test('topology refuses a connector whose authored seasonal geometry is missing', () => {
  const changed = layouts.map(row => ({ ...row, connector: row.connector === null ? null : 'missing-connector' }));
  assert.throws(() => parseFootpathLayouts(changed), ArtRegistryError);
});

test('path strip selection uses the axis and season rules', () => {
  for (const stage of ['ne', 'nw']) for (const season of ['summer', 'winter']) {
    assert.equal(selectLandArt('path-strip', { family: 'path', stage, season }).id, `path_clear_${stage}_${season}`);
  }
});

test('rejects omitted or extraneous strip ports without replacing the published layouts', () => {
  const original = JSON.stringify(FOOTPATH_RULES);
  for (const row of layouts.filter(row => row.connector === null && row.ports !== '')) {
    const missing = layouts.map(candidate => candidate === row ? { ...candidate, halves: candidate.halves.slice(1) } : candidate);
    assert.throws(() => parseFootpathLayouts(missing), ArtRegistryError, `missing half for ${row.ports}`);
  }
  for (const row of layouts.filter(row => row.ports !== 'NE+SE+SW+NW')) {
    const extra = PORTS.find(port => !row.ports.split('+').includes(port));
    assert.ok(extra);
    const invalid = layouts.map(candidate => candidate === row ? { ...candidate, halves: [...candidate.halves, extra] } : candidate);
    assert.throws(() => parseFootpathLayouts(invalid), ArtRegistryError, `extra half for ${row.ports}`);
  }
  assert.equal(JSON.stringify(FOOTPATH_RULES), original);
});

test('rejects every incompatible shape assignment across all 16 connection sets', () => {
  for (const row of layouts) for (const shape of new Set(layouts.map(candidate => candidate.shape))) {
    if (shape === row.shape) continue;
    const changed = layouts.map(candidate => candidate === row ? { ...candidate, shape } : candidate);
    assert.throws(() => parseFootpathLayouts(changed), ArtRegistryError, `${row.ports} cannot have shape ${shape}`);
  }
});

test('rejects a strip half that duplicates an already represented connector port', () => {
  for (const row of layouts.filter(row => row.connector !== null)) {
    const firstPort = row.ports.split('+')[0];
    assert.ok(firstPort);
    const changed = layouts.map(candidate => candidate === row ? { ...candidate, halves: [firstPort] } : candidate);
    assert.throws(() => parseFootpathLayouts(changed), ArtRegistryError, `duplicate representation for ${row.ports}`);
  }
});

test('accepts complementary connector ports and strip halves without naming the image', () => {
  const corner = layouts.find(row => row.ports === 'SW+NW');
  assert.ok(corner?.connector);
  const changed = layouts.map(row => row.ports === 'SE+SW+NW' ? { ...row, connector: corner.connector, halves: ['SE'] } : row);
  const parsed = parseFootpathLayouts(changed);
  assert.equal(parsed['SE+SW+NW']?.connector, corner.connector);
  assert.deepEqual(parsed['SE+SW+NW']?.halves, ['SE']);
});

test('rejects incomplete connector-plus-strip coverage for either seasonal entry', () => {
  const corner = layouts.find(row => row.ports === 'SW+NW');
  assert.ok(corner?.connector);
  const missing = layouts.map(row => row.ports === 'SE+SW+NW' ? { ...row, connector: corner.connector, halves: [] } : row);
  assert.throws(() => parseFootpathLayouts(missing), ArtRegistryError);
  const extra = layouts.map(row => row.ports === 'NE+SE' ? { ...row, connector: corner.connector, halves: [] } : row);
  assert.throws(() => parseFootpathLayouts(extra), ArtRegistryError);
});

test('rejects connector port loss in either season even when the other season remains valid', () => {
  const corner = layouts.find(row => row.ports === 'SW+NW');
  assert.ok(corner?.connector);
  for (const season of ['summer', 'winter']) {
    const registry = createArtRegistry(validatedCatalog.map(bundle => ({ ...bundle,
      entries: bundle.entries.map(entry => entry.kind === 'land-stage' && entry.stage === corner.connector && entry.season === season ? { ...entry, ports: {} } : entry),
    })));
    assert.throws(() => parseFootpathLayouts(layouts, registry), ArtRegistryError, `port loss in ${season}`);
  }
});
