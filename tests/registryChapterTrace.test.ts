import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { advanceTrace, traceCommand, traceOf } from '../src/engine/decisionTrace';
import type { GameState } from '../src/engine/engine.types';
import { advanceHistory, recordDecision } from '../src/engine/history';
import { initialPolitics, respondToPetition } from '../src/engine/politics';
import { advanceRegistry, initialRegistry } from '../src/engine/registry';
import { prepareRegistryChapterPetition } from '../src/engine/registryChapterPetitions';
import { decodeSave } from '../src/save/saveCodec';
import { initialAgency } from '../src/engine/townAgency';

function offered(id: string): GameState {
  const base = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const state = prepareRegistryChapterPetition({ ...base, tick: 328000, agency: initialAgency(), politics: initialPolitics(base),
    trace: { decisions: [], acts: [] }, buildings: [
      { id: 'market', kind: 'market', workers: 4, tx: 10, ty: 10, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
      { id: 'chapel', kind: 'chapel', workers: 0, tx: 12, ty: 10, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
    ] }, id);
  assert.ok(state);
  const petition = state.politics?.petitions.find(item => item.defId === id);
  assert.ok(petition);
  return { ...state, registry: { ...initialRegistry(), occurrences: [{ id: `trace:${id}`, entryId: id, source: 'v4',
    boundId: petition.id, bound: { chapterPetition: petition.id }, offeredTick: state.tick, deadline: state.tick + 1000,
    weights: id === 'ck_evt_057' ? ['rights'] : [], status: 'offered', receipt: { draw: 0, chancePermille: 1000, conditions: [] } }] } };
}

test('registry-owned chapter expiry creates one decision for the underlying matter', () => {
  // Given: matching chapter and registry records at the deadline.
  for (const id of ['ck_evt_057', 'ck_evt_058']) {
    const state = offered(id), before = { ...state, tick: state.tick + 1000 };
    // When: the actual registry/history/trace expiry pipeline runs.
    const after = advanceTrace(before, advanceHistory(before, advanceRegistry(before)));
    // Then: there is one registry lapse, carrying its original decision weights.
    const decisions = traceOf(after).decisions.filter(item => item.lapsed);
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]?.source, `registry:${id}:lapsed`);
    assert.deepEqual(decisions[0]?.weights, id === 'ck_evt_057' ? ['rights'] : []);
  }
});

test('direct chapter response traces the same registry weights instead of generic crisis', () => {
  for (const id of ['ck_evt_057', 'ck_evt_058']) {
    // Given: the occurrence has deliberately stale cached weights.
    const initial = offered(id);
    assert.ok(initial.registry);
    const before = { ...initial, registry: { ...initial.registry, occurrences: initial.registry.occurrences.map(item => ({ ...item, weights: ['crisis'] as const })) } };
    const petition = before.politics?.petitions.find(item => item.defId === id);
    assert.ok(petition);
    const command = { type: 'petition_response', petitionId: petition.id, response: 'accept_with_price' } as const;
    // When: a direct response goes through the real history and command trace handlers.
    const after = traceCommand(before, recordDecision(before, respondToPetition(before, petition.id, command.response), command), command);
    // Then: current enabled-choice weighing wins over both cached and generic weights.
    assert.equal(traceOf(after).decisions.length, 1);
    assert.deepEqual(traceOf(after).decisions[0]?.weights, id === 'ck_evt_057' ? ['rights'] : []);
  }
});

test('later expiry of a held registry petition does not invent another crisis decision', () => {
  // Given: its registry choice is already answered while the underlying petition waits.
  const initial = offered('ck_evt_058');
  assert.ok(initial.registry);
  const before: GameState = { ...initial, tick: initial.tick + 1000, registry: { ...initial.registry,
    occurrences: initial.registry.occurrences.map(item => ({ ...item, status: 'answered', choiceId: 'hold' })) } };
  // When: the underlying petition expires.
  const after = advanceTrace(before, advanceHistory(before, advanceRegistry(before)));
  // Then: the original registry decision remains the only matter; no new heavy lapse appears.
  assert.equal(after.politics?.petitions[0]?.response, 'expired');
  assert.deepEqual(traceOf(after).decisions, []);
});

test('unmatched native chapter expiry still produces its crisis decision', () => {
  // Given: a native petition even with an unrelated registry binding present.
  const initial = offered('ck_evt_058');
  assert.ok(initial.politics);
  const before: GameState = { ...initial, politics: { ...initial.politics,
    petitions: [{ id: 'native', defId: 'market_charter', arrivedTick: 0, petitioner: 'merchants' }] } };
  const expired: GameState = { ...before, politics: { ...initial.politics,
    petitions: [{ id: 'native', defId: 'market_charter', arrivedTick: 0, petitioner: 'merchants', response: 'expired', respondedTick: before.tick }] } };
  // When: normal chapter history and trace observe the expiry.
  const after = advanceTrace(before, advanceHistory(before, expired));
  // Then: native expiry remains visible and heavy.
  assert.equal(traceOf(after).decisions.length, 1);
  assert.equal(traceOf(after).decisions[0]?.source, 'petition:market_charter:expired');
  assert.deepEqual(traceOf(after).decisions[0]?.weights, ['crisis']);
});

test('chapter expiry suppression requires the exact registry source, entry and petition identity', () => {
  // Given: a registry definition with a record that does not actually own this petition.
  const initial = offered('ck_evt_058');
  assert.ok(initial.registry && initial.politics);
  for (const mismatch of [{ bound: { chapterPetition: 'other-petition' } }, { entryId: 'ck_evt_057' }, { source: undefined }]) {
    const before: GameState = { ...initial, registry: { ...initial.registry,
      occurrences: initial.registry.occurrences.map(item => {
        const { source, ...rest } = item;
        return 'source' in mismatch ? rest : { ...rest, ...(source === undefined ? {} : { source }), ...mismatch };
      }) } };
    const expired: GameState = { ...before, politics: { ...initial.politics,
      petitions: initial.politics.petitions.map(item => ({ ...item, response: 'expired', respondedTick: before.tick })) } };
    // When: trace observes only the petition expiry.
    const after = advanceTrace(before, advanceHistory(before, expired));
    // Then: an unrelated occurrence cannot suppress its decision.
    assert.equal(traceOf(after).decisions.length, 1);
    assert.equal(traceOf(after).decisions[0]?.source, 'petition:ck_evt_058:expired');
  }
});
