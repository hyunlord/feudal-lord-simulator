import assert from 'node:assert/strict';
import test from 'node:test';
import { readCanon } from '../scripts/registryCanon';
import { withPetitionContextAdapter, type ContextAdaptableEntry } from '../scripts/registryContextAdapters';
import { v4Entry, registryV4Support } from '../src/engine/registryV4';
import { V4_HELD_ENTRIES } from '../src/content/registry/v4Holds.generated';
const batch = ['061', '077', '083', '090', '092', '057', '058', '075', '076', '080', '147'].map(id => 'ck_evt_' + id);
test('cumulative batches activate exactly eleven candidates and preserve five non-drawn variants and eleven held adapters', () => {
  for (const id of batch) assert.ok(v4Entry(id), id);
  for (const id of ['041', '048', '056', '067', '078']) {
    assert.ok(v4Entry('ck_evt_' + id));
    assert.equal(registryV4Support().find(entry => entry.id === 'ck_evt_' + id)?.runs, false);
  }
  for (const id of ['050', '062', '065', '068', '085', '087', '088', '093', '095', '100', '170']) {
    assert.ok(v4Entry('ck_evt_' + id));
    const held = registryV4Support().find(entry => entry.id === 'ck_evt_' + id);
    assert.equal(held?.runs, false);
    assert.match(held?.reason ?? '', /^held [(]DEC-TRACE[)]/);
  }
  const expectedHeldChoices: Readonly<Record<string, readonly string[]>> = {
    ck_evt_087: ['b', 'c'], ck_evt_088: ['a', 'b', 'c'], ck_evt_093: ['b', 'c'],
    ck_evt_095: ['a', 'b', 'c'], ck_evt_100: ['a', 'b'], ck_evt_170: ['a', 'b'],
    ck_evt_050: ['growth', 'revenue', 'stability'], ck_evt_062: ['b', 'c'],
    ck_evt_065: ['a', 'b', 'c'], ck_evt_068: ['a', 'b', 'c'], ck_evt_085: ['a', 'b', 'c'],
  };
  for (const [id, choices] of Object.entries(expectedHeldChoices)) {
    assert.deepEqual(registryV4Support().find(entry => entry.id === id)?.choices.filter(choice => !choice.supported).map(choice => choice.id).sort(), choices);
  }
  assert.equal(V4_HELD_ENTRIES.length, 38);
  const support = registryV4Support();
  for (const id of batch) assert.equal(support.find(entry => entry.id === id)?.runs, true, id);
  for (const held of V4_HELD_ENTRIES) assert.equal(support.find(entry => entry.id === held.id)?.runs, false, held.id);
});

test('every other canon entry retains its unsupported filters and activation status', () => {
  const canon = readCanon<{ readonly id: string }, ContextAdaptableEntry>();
  for (const entry of canon.registry.entries) {
    if ([...batch, 'ck_evt_041', 'ck_evt_048', 'ck_evt_056', 'ck_evt_067', 'ck_evt_078', 'ck_evt_050', 'ck_evt_062', 'ck_evt_065', 'ck_evt_068', 'ck_evt_085', 'ck_evt_087', 'ck_evt_088', 'ck_evt_093', 'ck_evt_095', 'ck_evt_100', 'ck_evt_170'].includes(entry.id)) continue;
    assert.deepEqual(withPetitionContextAdapter(entry), entry, entry.id);
    assert.equal(v4Entry(entry.id) !== undefined, entry.unsupportedFilters.length === 0, entry.id);
  }
});
