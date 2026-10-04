import assert from 'node:assert/strict';
import test from 'node:test';
import catalog from '../src/render/art/catalog.json';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { treeStageArt } from '../src/render/landStageModel';
import { treeStageItem } from '../src/render/landStageItems';
import { pathArtScale, stageKey } from '../src/render/wave42StageArt';
import layouts from '../src/render/art/bundles/footpath-layouts.json';
import { parseFootpathLayouts } from '../src/render/footpathModel';

test('land queue preserves the actual selected variant ID even when its stage and season are shared', () => {
  const harvest = { tx: 0, ty: 0, harvestedAtTick: 0 };
  const selected = treeStageArt(harvest, 0, 'summer');
  const data = structuredClone(catalog);
  const bundle = data[0];
  assert.ok(bundle);
  const original = bundle.entries.find(entry => entry.id === selected.id);
  assert.ok(original);
  const extra = { ...original, id: 'authored-alternate-stump', geometry: { ...original.geometry, scale: 0.75 } };
  bundle.entries.push(extra);
  for (const rule of bundle.rules) if (rule.variants.some(variant => variant.assetId === selected.id)) {
    rule.variants = [{ assetId: extra.id, weight: 1 }];
  }
  const registry = createArtRegistry(data);
  const piece = treeStageItem(harvest, 0, registry).piece;
  assert.equal(piece.picture, selected.stage);
  assert.equal(piece.editions.summer, extra.id);
  assert.equal(piece.editions.winter, treeStageArt(harvest, 0, 'winter', registry).id);
  assert.equal(registry.entry(piece.editions.summer)?.kind, 'land-stage');
  assert.equal(pathArtScale(registry), 0.5);
});

test('an independently scaled unrelated land family does not constrain the path projection', () => {
  const data = structuredClone(catalog);
  const bundle = data[0];
  assert.ok(bundle);
  const original = bundle.entries.find(entry => entry.layout === 'single');
  assert.ok(original);
  bundle.entries.push({ ...original, id: 'other-family-example', family: 'independent-family',
    geometry: { ...original.geometry, scale: 0.125 } });
  assert.equal(pathArtScale(createArtRegistry(data)), 0.5);
});

test('connector draw resolves the selected path variant instead of an ambiguous stage lookup', () => {
  const data = structuredClone(catalog);
  const bundle = data[0];
  assert.ok(bundle);
  const original = bundle.entries.find(entry => entry.layout === 'connector' && entry.season === 'summer');
  assert.ok(original);
  const alternate = { ...original, id: 'authored-path-alternate' };
  bundle.entries.push(alternate);
  for (const rule of bundle.rules) if (rule.variants.some(variant => variant.assetId === original.id)) {
    rule.variants = [{ assetId: alternate.id, weight: 1 }];
  }
  const registry = createArtRegistry(data);
  assert.equal(stageKey(original.stage, 'summer', registry), alternate.id);
  assert.doesNotThrow(() => parseFootpathLayouts(layouts, registry));
  const invalid = data.map(item => ({ ...item, entries: item.entries.map(entry =>
    entry.id === alternate.id ? { ...entry, ports: {} } : entry) }));
  assert.throws(() => parseFootpathLayouts(layouts, createArtRegistry(invalid)), /represent each port/);
});

test('legacy connector lookup stays within the path family like topology validation', () => {
  const data = structuredClone(catalog);
  const bundle = data[0];
  assert.ok(bundle);
  const original = bundle.entries.find(entry => entry.layout === 'connector' && entry.season === 'summer');
  assert.ok(original);
  const previous = original.stage;
  const stage = 'renamed-connector';
  for (const entry of bundle.entries) if (entry.stage === previous) entry.stage = stage;
  bundle.entries.push({ ...original, id: 'unrelated-connector', family: 'independent-family' });
  const registry = createArtRegistry(data);
  const changedLayouts = layouts.map(row => ({ ...row, connector: row.connector === previous ? stage : row.connector }));
  assert.doesNotThrow(() => parseFootpathLayouts(changedLayouts, registry));
  assert.equal(stageKey(stage, 'summer', registry), original.id);
});
