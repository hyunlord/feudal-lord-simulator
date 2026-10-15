import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { navigationStateSha256 as hash } from './navigationState.mjs';
const base = { tick: 9, seen: ['card'], nested: { seen: ['keep'] }, list: [{ seen: 1 }], treasuryCoin: 4 };
test('only the root seen value or presence is exempt', () => {
  assert.equal(hash(base), hash({ ...base, seen: ['other'] }));
  const { seen, ...absent } = base;
  assert.equal(hash(base), hash(absent));
});
test('nested seen, array seen, ticks and economic state remain protected', () => {
  for (const state of [{ ...base, nested: { seen: ['changed'] } }, { ...base, list: [{ seen: 2 }] },
    { ...base, tick: 10 }, { ...base, treasuryCoin: 5 }, { ...base, extra: true }]) assert.notEqual(hash(base), hash(state));
});
test('hashing does not mutate original state or raw bytes', () => {
  const raw = JSON.stringify(base), checksum = createHash('sha256').update(raw).digest('hex');
  Object.freeze(base); Object.freeze(base.nested); Object.freeze(base.list);
  assert.equal(hash(base), hash(raw)); assert.equal(JSON.stringify(base), raw);
  assert.equal(createHash('sha256').update(raw).digest('hex'), checksum);
  assert.notEqual(createHash('sha256').update(JSON.stringify({ ...base, seen: [] })).digest('hex'), checksum);
});
