import assert from 'node:assert/strict';
import test from 'node:test';
import type { RegistryOccurrence } from '../src/engine/registry.types';
import { createRegistryOccurrenceCollector } from '../scripts/registryDecisionOccurrences';

const offer = (index: number): RegistryOccurrence => ({ id: `registry:test:${index}`, entryId: `event-${index % 3}`, boundId: '',
  offeredTick: index * 1000, deadline: (index + 1) * 1000, status: 'offered', receipt: { draw: 0, chancePermille: 1000, conditions: [] } });

test('runner retains every offer and its latest observed status beyond the engine 400-record window', () => {
  const collector = createRegistryOccurrenceCollector();
  let retained: readonly RegistryOccurrence[] = [];
  for (let index = 0; index < 650; index += 1) {
    retained = [...retained, offer(index)].slice(-400);
    collector.observe(retained);
    retained = retained.map(item => item.id === `registry:test:${index}` ? { ...item, status: 'answered', choiceId: 'a', settledTick: item.offeredTick } : item);
    collector.observe(retained);
  }
  assert.equal(retained.length, 400);
  const all = collector.snapshot();
  assert.equal(all.length, 650);
  assert.deepEqual(all.map(item => item.id), Array.from({ length: 650 }, (_, index) => `registry:test:${index}`));
  assert.ok(all.every(item => item.status === 'answered' && item.choiceId === 'a'));
  assert.equal(all[0]?.offeredTick, 0);
  assert.equal(all.at(-1)?.offeredTick, 649000);
});

test('runner observation is read-only and updates existing IDs without counting another offer', () => {
  const collector = createRegistryOccurrenceCollector();
  const first = Object.freeze(offer(0));
  const initial = Object.freeze([first]);
  collector.observe(initial);
  collector.observe(initial);
  const before = collector.snapshot();
  collector.observe([{ ...first, status: 'lapsed', settledTick: 1000 }]);
  assert.equal(collector.snapshot().length, 1);
  assert.equal(collector.snapshot()[0]?.status, 'lapsed');
  assert.equal(before[0]?.status, 'offered');
  assert.equal(initial[0]?.status, 'offered');
  collector.observe([]);
  assert.equal(collector.snapshot().length, 1);
});
