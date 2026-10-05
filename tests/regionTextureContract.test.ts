import assert from 'node:assert/strict';
import test from 'node:test';
import baseline from './fixtures/region-texture-migration.json';
import field from './fixtures/field-texture-migration.json';
import { createArtRegistry } from '../src/render/art/artRegistry';

test('region thirty sources cover forty base roles alongside unchanged FIELD', () => {
  const registry = createArtRegistry([field, baseline]);
  assert.equal(registry.entries('ground-texture').length, 34);
  for (const rule of baseline.rules) {
    const context = Object.fromEntries(rule.conditions.map(c => [c.field, c.value]));
    assert.equal(registry.select('ground-texture', rule.slot, context, 0)?.id, rule.variants[0]?.assetId);
  }
});
test('region startup rejects missing role, foreign branch, unknown role and invalid geometry', () => {
  const first = baseline.rules[0]; const entry = baseline.entries[0]; assert.ok(first && entry);
  for (const rule of baseline.rules) assert.throws(() => createArtRegistry([{ ...baseline, rules: baseline.rules.filter(r => r.id !== rule.id) }]));
  for (const bad of [
    { ...first, slot: 'unknown' }, { ...first, slot: 'land-region-unknown' }, { ...first, priority: 1 },
    { ...first, conditions: first.conditions.map(c => ({ ...c, value: 'unsupported' })) },
    { ...first, conditions: [{ field: 'baseId', op: 'eq', value: entry.baseId }, { field: 'baseId', op: 'eq', value: entry.baseId }] },
    { ...first, conditions: [...first.conditions, { field: 'fieldState', op: 'eq', value: 'seedling' }] },
    { ...first, variants: [{ assetId: field.entries[0]?.id, weight: 1 }] },
    { ...first, variants: [{ assetId: baseline.entries.find(e => e.baseId !== entry.baseId)?.id, weight: 1 }] },
  ]) assert.throws(() => createArtRegistry([field, { ...baseline, rules: [bad, ...baseline.rules.slice(1)] }]));
  for (const bad of [
    { ...entry, mapping: { ...entry.mapping, origin: { x: 1, y: 0 } } },
    { ...entry, image: { ...entry.image, width: 512 } },
    { ...entry, mapping: { ...entry.mapping, sourcePixelsPerTile: { u: Infinity, v: 64 } } },
    { ...entry, baseId: 'riverside' },
    { ...entry, composition: { wash: 'none', joinFadeSourcePx: 40 } },
  ]) assert.throws(() => createArtRegistry([{ ...baseline, entries: [bad, ...baseline.entries.slice(1)] }]));
});
test('optional region spring roles are complete pairs and cannot override other seasons', () => {
  const rules = baseline.rules.filter(r => r.conditions.some(c => c.field === 'baseId' && c.value === 'chalk_down') && r.conditions.some(c => c.field === 'season' && c.value === 'spring')).map(r => ({ ...r, id: r.id + '-season', slot: r.slot.replace('base', 'season') }));
  assert.equal(rules.length, 2);
  assert.doesNotThrow(() => createArtRegistry([{ ...baseline, rules: [...baseline.rules, ...rules] }]));
  assert.throws(() => createArtRegistry([{ ...baseline, rules: [...baseline.rules, ...rules.slice(0, 1)] }]));
  const wrongSeason = rules.map(r => ({ ...r, conditions: r.conditions.map(c => c.field === 'season' ? { ...c, value: 'winter' } : c) }));
  assert.throws(() => createArtRegistry([{ ...baseline, rules: [...baseline.rules, ...wrongSeason] }]));
});
