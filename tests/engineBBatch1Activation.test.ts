import assert from 'node:assert/strict';
import test from 'node:test';
import { readCanon } from '../scripts/registryCanon';
import { withPetitionContextAdapter, type ContextAdaptableEntry } from '../scripts/registryContextAdapters';
import { v4Entry, registryV4Support } from '../src/engine/registryV4';
import { V4_BLOCKED_ENTRIES } from '../src/content/registry/v4Entries.generated';
import { V4_HELD_ENTRIES } from '../src/content/registry/v4Holds.generated';
const batch = ['061', '077', '083', '090', '092'].map(id => 'ck_evt_' + id);
test('first batch activates exactly five authored contexts and keeps audit holds off', () => {
  for (const id of batch) assert.ok(v4Entry(id), id);
  for (const id of ['041','048','050','056','057','058','062','065','067','068','075','076','078','080','085','087','088','093','095','100','147','170']) {
    assert.ok(V4_BLOCKED_ENTRIES.some(entry => entry.id === 'ck_evt_' + id), id);
  }
  assert.equal(V4_HELD_ENTRIES.length, 38);
  const support = registryV4Support();
  for (const id of batch) assert.equal(support.find(entry => entry.id === id)?.runs, true, id);
  for (const held of V4_HELD_ENTRIES) assert.equal(support.find(entry => entry.id === held.id)?.runs, false, held.id);
});

test('every other canon entry retains its unsupported filters and activation status', () => {
  const canon = readCanon<{ readonly id: string }, ContextAdaptableEntry>();
  for (const entry of canon.registry.entries) {
    if (batch.includes(entry.id)) continue;
    assert.deepEqual(withPetitionContextAdapter(entry), entry, entry.id);
    assert.equal(v4Entry(entry.id) !== undefined, entry.unsupportedFilters.length === 0, entry.id);
  }
});
