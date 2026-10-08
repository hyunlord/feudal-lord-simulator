import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { estatesOf } from '../src/engine/estates';
import { advanceHistory, compactHistory } from '../src/engine/history';
import { stewardSuccessionContext } from '../src/engine/registryStewardSuccessionContext';
import { stateCalendar } from '../src/engine/scenarioState';
import { advanceStewardship, EMPTY_STEWARDSHIP, setEstateOversight } from '../src/engine/stewardship';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave, encodeSave } from '../src/save/saveCodec';

function succession() {
  const base = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const person = base.persons?.people[0];
  const original = estatesOf(base).estates[0];
  assert.ok(person && original);
  const tick = base.tick + (1348 - stateCalendar(base).year) * 4000 - base.tick % 4000 + 1000;
  const estate = { ...original, id: 'succession-estate', offMap: true, titleHolder: 'lord', possessor: 'lord', pieces: original.pieces.map(piece => ({ ...piece, titleHolder: 'lord', possessor: 'lord' })) };
  const old = { personId: 'old', estateId: estate.id, ability: 40, loyalty: 40, disposition: 'greedy' as const, connection: null, since: 0, kept: 0, errors: 0, status: 'serving' as const };
  const successor = { ...old, personId: 'successor', loyalty: 99, status: 'candidate' as const };
  const merchant = { ...old, personId: 'merchant', disposition: 'merchant' as const, status: 'candidate' as const };
  const peasant = { ...old, personId: 'peasant', disposition: 'peasant' as const, status: 'candidate' as const };
  const before: GameState = { ...base, tick, agency: initialAgency(), estates: { ...estatesOf(base), estates: [estate],
    people: [old, successor, merchant, peasant].map(item => ({ ...person, id: item.personId, alive: true, birthYear: 1300 })) },
    stewardship: { ...EMPTY_STEWARDSHIP, stewards: [old, successor, merchant, peasant], oversight: [{ estateId: estate.id, mode: 'steward', stewardId: old.personId,
      auditMode: 'accounts', tenants: 0, merchants: 0, undetected: 0, since: 0 }] } };
  assert.ok(before.estates);
  const death: GameState = { ...before, estates: { ...before.estates, people: before.estates.people.map(item => item.id === old.personId
    ? { ...item, alive: false, deathCause: 'age' as const, deathYear: 1348 } : item) } };
  const state = advanceHistory(before, advanceStewardship(death));
  const current = state.stewardship?.stewards.find(item => item.personId === 'successor');
  assert.ok(current && current.status === 'serving');
  const bound = { estate, currentSteward: current, peasantCandidate: peasant, merchantCandidate: merchant };
  return { state, bound };
}

test('147 reconstructs the actual emitted predecessor-to-successor transition, stable through save and history compaction', () => {
  const { state, bound } = succession();
  const before = JSON.stringify(state);
  const context = stewardSuccessionContext(state, bound);
  assert.ok(context);
  assert.equal(JSON.stringify(state), before);
  assert.equal(context.subjectKey, 'succession-estate');
  const history = state.history;
  assert.ok(history);
  const transition = history.records.find(item => item.template === 'stewardship.steward_died');
  assert.equal(transition?.params?.deceasedId, 'old');
  assert.equal(transition?.params?.stewardId, 'successor');
  const compacted = { ...state, history: compactHistory(history, state.tick + 12000) };
  assert.deepEqual(stewardSuccessionContext(compacted, bound, context), context);
  const loaded = decodeSave(encodeSave({ state, createdAt: '2026-10-06T00:00:00Z', savedAt: '2026-10-06T00:00:00Z' }).bytes).envelope.state;
  assert.deepEqual(stewardSuccessionContext(loaded, bound, context), context);
});

test('147 rejects an arbitrary dead steward, changed successor, wrong estate or absent candidate', () => {
  const { state, bound } = succession();
  assert.ok(state.history && state.estates && state.stewardship);
  const noTransition = { ...state, history: { ...state.history, records: state.history.records.filter(item => item.template !== 'stewardship.steward_died') } };
  assert.equal(stewardSuccessionContext(noTransition, bound), null);
  const wrongEstate = { ...state, stewardship: { ...state.stewardship, stewards: state.stewardship.stewards.map(item => item.personId === 'old' ? { ...item, estateId: 'another-estate' } : item) } };
  assert.equal(stewardSuccessionContext(wrongEstate, bound), null);
  const changed = { ...state, stewardship: { ...state.stewardship, oversight: state.stewardship.oversight.map(item => ({ ...item, stewardId: 'merchant' })) } };
  assert.equal(stewardSuccessionContext(changed, bound), null);
  const absent = { ...state, estates: { ...state.estates, people: state.estates.people.filter(item => item.id !== 'merchant') } };
  assert.equal(stewardSuccessionContext(absent, bound), null);
  const context = stewardSuccessionContext(state, bound);
  assert.ok(context);
  assert.equal(stewardSuccessionContext(state, bound, { ...context, subjectKey: 'another-estate' }), null);
});

test('147 factual succession candidates execute three distinct existing oversight choices', () => {
  const { state, bound } = succession();
  assert.ok(stewardSuccessionContext(state, bound));
  const peasant = setEstateOversight(state, bound.estate.id, 'steward', bound.peasantCandidate.personId);
  const merchant = setEstateOversight(state, bound.estate.id, 'steward', bound.merchantCandidate.personId);
  const direct = setEstateOversight(state, bound.estate.id, 'direct', bound.currentSteward.personId);
  assert.notEqual(peasant, state);
  assert.notEqual(merchant, state);
  assert.notEqual(direct, state);
  assert.equal(peasant.stewardship?.oversight.find(item => item.estateId === bound.estate.id)?.stewardId, 'peasant');
  assert.equal(merchant.stewardship?.oversight.find(item => item.estateId === bound.estate.id)?.stewardId, 'merchant');
  assert.equal(direct.stewardship?.oversight.find(item => item.estateId === bound.estate.id)?.mode, 'direct');
  assert.equal(stewardSuccessionContext(peasant, bound), null);
  assert.equal(stewardSuccessionContext(merchant, bound), null);
});

test('147 registry binds the emitted transition and answers fixed candidates after save/load', async () => {
  const { bindEntry, boundIdentities, v4Entry } = await import('../src/engine/registryV4');
  const { answerRegistryOffer, initialRegistry, offerChoices } = await import('../src/engine/registry');
  const { state: produced, bound: actual } = succession();
  assert.ok(produced.estates && produced.stewardship);
  const otherEstates = Array.from({ length: 4 }, (_, index) => ({ ...actual.estate, id: `attention-estate-${index}`,
    pieces: actual.estate.pieces.map(piece => ({ ...piece, id: `${piece.id}-attention-${index}` })) }));
  const livingPerson = produced.estates.people.find(person => person.id === actual.currentSteward.personId);
  assert.ok(livingPerson);
  const additionalStewards = otherEstates.map(estate => ({ ...actual.currentSteward, estateId: estate.id, personId: `${estate.id}-steward` }));
  const state: GameState = { ...produced, estates: { ...produced.estates, estates: [...produced.estates.estates, ...otherEstates],
    people: [...produced.estates.people, ...additionalStewards.map(steward => ({ ...livingPerson, id: steward.personId }))] },
    stewardship: { ...produced.stewardship, stewards: [...produced.stewardship.stewards, ...additionalStewards],
      oversight: [...produced.stewardship.oversight, ...otherEstates.map(estate => ({
      estateId: estate.id, mode: 'direct' as const, stewardId: `${estate.id}-steward`, auditMode: 'accounts' as const,
      tenants: 0, merchants: 0, undetected: 0, since: 0 }))] } };
  const entry = v4Entry('ck_evt_147');
  assert.ok(entry, '147 generated adapter integrated');
  const bound = bindEntry(state, entry);
  assert.ok(bound, 'all original canonical conditions hold');
  assert.deepEqual(bound.estate, actual.estate, 'attention-only estates cannot replace the actual succession estate');
  const occurrence = { id: 'registry:147:succession', entryId: entry.id, source: 'v4' as const, boundId: actual.estate.id,
    offeredTick: state.tick, deadline: state.tick + 1000, status: 'offered' as const, bound: boundIdentities(bound),
    receipt: { draw: 0, chancePermille: 1000, conditions: [] } };
  const offered: GameState = { ...state, registry: { ...initialRegistry(), occurrences: [occurrence] } };
  const loaded = decodeSave(encodeSave({ state: offered, createdAt: '2026-10-06T00:00:00Z', savedAt: '2026-10-06T00:00:00Z' }).bytes).envelope.state;
  assert.deepEqual(offerChoices(loaded, occurrence), ['a', 'b', 'c']);
  for (const [choice, expected] of [['a', 'peasant'], ['b', 'merchant'], ['c', 'successor']] as const) {
    const answered = answerRegistryOffer(loaded, occurrence.id, choice);
    assert.equal(answered.registry?.occurrences.find(item => item.id === occurrence.id)?.status, 'answered');
    const oversight = answered.stewardship?.oversight.find(item => item.estateId === actual.estate.id);
    assert.equal(oversight?.stewardId, expected);
    assert.equal(oversight?.mode, choice === 'c' ? 'direct' : 'steward');
    assert.equal(answerRegistryOffer(answered, occurrence.id, choice), answered);
  }
  assert.ok(loaded.history);
  const missing = { ...loaded, history: { ...loaded.history, records: loaded.history.records.filter(item => item.template !== 'stewardship.steward_died') } };
  assert.deepEqual(offerChoices(missing, occurrence), []);
  const refused = answerRegistryOffer(missing, occurrence.id, 'a');
  assert.equal(refused.registry?.occurrences.find(item => item.id === occurrence.id)?.status, 'invalid');
  assert.deepEqual(refused.stewardship, missing.stewardship);
});
