import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decodeSave } from '../src/save/saveCodec';
import { canonicalTlinkRuleState, createTlinkParityObserver } from '../scripts/engineBTlinkParity';
import type { GameState } from '../src/engine/engine.types';
const base = (): GameState => decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
function fingerprint(state: GameState) {
  const observer = createTlinkParityObserver();
  observer.observe(state, { phase: 'initial', commandOrdinal: 0 });
  return observer.snapshot().finalHash;
}
test('history-only changes excluded; acts, money and unknown fields retained', () => {
  const state = base();
  const { history: ignored, ...withoutHistory } = state; void ignored;
  assert.equal(fingerprint(state), fingerprint(withoutHistory));
  assert.notEqual(fingerprint(state), fingerprint({ ...state, treasuryCoin: state.treasuryCoin + 1 }));
  const trace = { decisions: [], acts: [] };
  const first = { ...state, trace };
  const decision = { id: 'diagnostic-only', tick: 0, by: 'lord', kind: 'registry', source: 'test', weights: [], targets: [] } as const;
  const annotated = { ...first, trace: { ...trace, decisions: [decision], answers: [{ ...decision, threadId: decision.id, memoryEvidence: [] }] } };
  assert.equal(fingerprint(first), fingerprint(annotated));
  assert.notEqual(fingerprint(first), fingerprint({ ...first, trace: { ...trace, acts: [{ factionId: 'x', tick: 1, size: 'small', direction: 1, act: 'gift', relation: 1 }] } }));
  assert.notEqual(fingerprint(first), fingerprint(Object.assign({}, first, { futureRule: 1 })));
});
test('rolling sequence sees intermediate change even when final state equals', () => {
  const a = createTlinkParityObserver(), b = createTlinkParityObserver();
  const state = { ...base(), tick: 0 };
  for (const o of [a,b]) o.observe(state, { phase: 'initial', commandOrdinal: 0 });
  a.observe(state, { phase: 'command', commandOrdinal: 1 });
  b.observe({ ...state, treasuryCoin: state.treasuryCoin + 1 }, { phase: 'command', commandOrdinal: 1 });
  for (const o of [a,b]) {
    o.observe({ ...state, tick: 1 }, { phase: 'tick', commandOrdinal: 1 });
    o.observe({ ...state, tick: 1 }, { phase: 'final', commandOrdinal: 1 });
  }
  assert.equal(a.snapshot().finalHash, b.snapshot().finalHash);
  assert.notEqual(a.snapshot().rollingHash, b.snapshot().rollingHash);
  assert.equal(a.snapshot().observations, 4);
});
test('missing tick/command and repeated initial observations reject', () => {
  const o = createTlinkParityObserver(), state = { ...base(), tick: 0 };
  o.observe(state, { phase: 'initial', commandOrdinal: 0 });
  assert.throws(() => o.observe({ ...state, tick: 2 }, { phase: 'tick', commandOrdinal: 0 }));
  assert.throws(() => o.observe(state, { phase: 'command', commandOrdinal: 2 }));
  assert.throws(() => o.observe(state, { phase: 'initial', commandOrdinal: 0 }));
});
test('uncached default detects in-place changes without mutating state', () => {
  const state = { ...base(), tick: 0 }, o = createTlinkParityObserver();
  const before = JSON.stringify(state);
  o.observe(state, { phase: 'initial', commandOrdinal: 0 });
  assert.equal(JSON.stringify(state), before);
  const first = o.snapshot().finalHash;
  state.treasuryCoin += 1;
  o.observe(state, { phase: 'command', commandOrdinal: 1 });
  assert.notEqual(o.snapshot().finalHash, first);
});
test('faction relations and ledger amounts remain significant', () => {
  const state = base();
  assert.ok(state.factions && state.factions.factions.length > 0);
  const factions = { ...state.factions, factions: state.factions.factions.map((row, index) => index === 0 ? { ...row, relation: row.relation + 1 } : row) };
  assert.notEqual(fingerprint(state), fingerprint({ ...state, factions }));
  assert.ok(state.ledger && state.ledger.entries.length > 0);
  const ledger = { ...state.ledger, entries: state.ledger.entries.map((row, index) => index === 0 ? { ...row, amount: row.amount + 1 } : row) };
  assert.notEqual(fingerprint(state), fingerprint({ ...state, ledger }));
});
test('tick-only interim changes are outside the documented sampled scope', () => {
  const a = createTlinkParityObserver({ seasonLength: 2 }), b = createTlinkParityObserver({ seasonLength: 2 });
  const state = { ...base(), tick: 0 };
  for (const o of [a,b]) o.observe(state, { phase: 'initial', commandOrdinal: 0 });
  a.observe({ ...state, tick: 1 }, { phase: 'tick', commandOrdinal: 0 });
  b.observe({ ...state, tick: 1, treasuryCoin: 12345 }, { phase: 'tick', commandOrdinal: 0 });
  for (const o of [a,b]) {
    o.observe({ ...state, tick: 2 }, { phase: 'tick', commandOrdinal: 0 });
    o.observe({ ...state, tick: 2 }, { phase: 'final', commandOrdinal: 0 });
  }
  assert.equal(a.snapshot().rollingHash, b.snapshot().rollingHash);
  assert.equal(a.snapshot().everyTickStateParity, false);
  assert.deepEqual(a.snapshot().checkpoints.map(row => row.phase), ['initial', 'tick', 'final']);
});

test('exported diagnostic bytes reproduce final checkpoint hash', () => {
  const state = base(), observer = createTlinkParityObserver();
  observer.observe(state, { phase: 'initial', commandOrdinal: 0 });
  observer.observe(state, { phase: 'final', commandOrdinal: 0 });
  assert.equal(createHash('sha256').update(canonicalTlinkRuleState(state)).digest('hex'), observer.snapshot().finalHash);
  assert.equal(observer.snapshot().finalized, true);
  assert.throws(() => observer.observe(state, { phase: 'final', commandOrdinal: 0 }));
});
