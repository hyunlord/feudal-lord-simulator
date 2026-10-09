import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { linkAnswerFactionReceipts } from '../src/engine/decisionTraceAnswers';
import type { GameState } from '../src/engine/engine.types';
import type { FactionMemory } from '../src/engine/faction.types';
import { initialFactions } from '../src/engine/factions';
import { decodeSave } from '../src/save/saveCodec';

/** Small producer-shaped receipt fixture: verifies attribution, not natural act occurrence. */
function probe(current: readonly FactionMemory[]): readonly string[] {
  const base = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const factions = initialFactions(base), faction = factions.factions[0]; assert.ok(faction); assert.ok(base.history);
  const memories = [{ recordId: 'm1', tick: 10, delta: 2, reason: 'first' }, { recordId: 'm2', tick: 20, delta: 9, reason: 'second' }];
  const after: GameState = { ...base, tick: 30, factions: { ...factions, factions: [{ ...faction, memory: current }] },
    trace: { decisions: [], acts: [{ factionId: faction.id, tick: 30, size: 'small', direction: 1, act: 'fixture', relation: 20 }],
      answers: memories.map((memory, index) => ({ id: `answer-${index}`, tick: memory.tick, threadId: 'root', by: 'lord', kind: 'estate_petition',
        source: memory.reason, weights: ['rights'], targets: [`faction:${faction.id}`], memoryEvidence: [{ ...memory, factionId: faction.id }] })) },
    history: { ...base.history, nextOrdinal: base.history.nextOrdinal + 1, records: [...base.history.records, {
      id: 'act-result', tick: 30, kind: 'faction', subject: { type: 'faction', id: faction.id }, severity: 1, template: 'faction.act',
      params: { faction: faction.id, relation: 20, act: 'fixture' }, because: [{ decisionId: 'root', key: 'faction_act', part: true }],
    }] },
  };
  const linked = linkAnswerFactionReceipts(base, after);
  assert.deepEqual(linked.factions, after.factions);
  assert.deepEqual(linked.trace, after.trace);
  assert.equal(linked.history?.nextOrdinal, after.history?.nextOrdinal);
  return linked.history?.records.at(-1)?.because?.map(cause => cause.decisionId) ?? [];
}
const first = { recordId: 'm1', tick: 10, delta: 2, reason: 'first', decisionId: 'root' };
const second = { recordId: 'm2', tick: 20, delta: 9, reason: 'second', decisionId: 'root' };
test('retained evidence cannot link an answer whose actual participating memory is absent', () => {
  assert.ok(!probe([first]).includes('answer-1'));
});
test('a current memory belonging to another root cannot supply the retained answer', () => {
  assert.ok(!probe([{ ...first, decisionId: 'other-root' }]).includes('answer-0'));
});
test('actual larger newer contribution is primary, not the older inserted answer', () => {
  assert.deepEqual(probe([first, second]), ['answer-1', 'answer-0']);
});
test('changed memory fields do not match old snapshots', () => {
  for (const memory of [{ ...first, delta: -2 }, { ...first, reason: 'other' }, { ...first, tick: 11 }])
    assert.ok(!probe([memory]).includes('answer-0'));
});
