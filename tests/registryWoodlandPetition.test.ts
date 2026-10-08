import { stateCalendar, scenarioOf } from '../src/engine/scenarioState';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { woodlandPetitionContext } from '../src/engine/registryWoodlandPetitionContext';
import { estatePetitionVariantFor } from '../src/engine/registryVariants';
import { registryV4Support, v4Candidates, v4Entry } from '../src/engine/registryV4';
import { answerEstatePetition, EMPTY_STEWARDSHIP } from '../src/engine/stewardship';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave, encodeSave } from '../src/save/saveCodec';

function fixture(): GameState {
  const base = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const tick = (Math.floor(base.tick / 4000) + 1) * 4000 + 2000;
  return { ...base, tick, archetypeId: 'core:forest_edge', agency: initialAgency(),
    tiles: base.tiles.map((tile, i) => i === 0 ? { ...tile, terrain: 'forest' } : tile),
    stewardship: { ...EMPTY_STEWARDSHIP, petitions: [{ id: 'pannage-real', estateId: 'estate-home', kind: 'pannage',
      group: 'tenants', amount: 20, rights: false, marriage: false, tick, deadline: tick + 1000, status: 'open' }] } };
}
const bound = { estatePetition: { id: 'pannage-real' } };

test('041 uses actual home woodland and the existing pannage arrival without a new draw or mutation', () => {
  const state = fixture();
  const before = JSON.stringify(state);
  assert.ok(woodlandPetitionContext(state, bound));
  const view = estatePetitionVariantFor(state, 'pannage-real');
  assert.equal(view?.variantEntryId, 'ck_evt_041');
  assert.equal(view?.sourceEntryId, 'home:pannage');
  assert.equal(view?.occurrenceId, 'pannage-real');
  assert.ok(view?.title.includes('돼지'));
  assert.equal(JSON.stringify(state), before);
  assert.ok(!v4Candidates(state, []).some(item => item.entry.id === 'ck_evt_041'));
  const support = registryV4Support().find(item => item.id === 'ck_evt_041');
  assert.equal(support?.runs, false);
  assert.equal(support?.reason, "a variant of an existing occurrence's words (ER-13), not drawn");
  const loaded = decodeSave(encodeSave({ state, createdAt: '2026-10-06T00:00:00Z', savedAt: '2026-10-06T00:00:00Z' }).bytes).envelope.state;
  assert.deepEqual(estatePetitionVariantFor(loaded, 'pannage-real'), view);
});

test('041 does not infer customary rights from other land or a pannage label alone', () => {
  const state = fixture();
  for (const archetypeId of ['core:open_field', 'core:chalk_downs', 'core:coastal_port', 'core:fen_drainage']) {
    assert.equal(estatePetitionVariantFor({ ...state, archetypeId }, 'pannage-real'), null);
  }
  assert.equal(estatePetitionVariantFor({ ...state, tiles: state.tiles.map(tile => ({ ...tile, terrain: 'grass' })) }, 'pannage-real'), null);
  const noAgency = { ...state };
  delete noAgency.agency;
  assert.equal(estatePetitionVariantFor(noAgency, 'pannage-real'), null);
  const noArchetype = { ...state };
  delete noArchetype.archetypeId;
  assert.equal(estatePetitionVariantFor(noArchetype, 'pannage-real'), null);
});

test('041 preserves autumn, real target, arrival, deadline, and open-status gates', () => {
  const state = fixture();
  assert.ok(state.stewardship);
  const petition = state.stewardship.petitions[0];
  assert.ok(petition);
  for (const patch of [{ estateId: 'estate-neighbour-1' }, { kind: 'newcomer' as const }, { status: 'granted' as const },
    { reachesLord: state.tick + 1 }, { deadline: state.tick - 1 }]) {
    const changed: GameState = { ...state, stewardship: { ...state.stewardship, petitions: [{ ...petition, ...patch }] } };
    assert.equal(estatePetitionVariantFor(changed, petition.id), null);
  }
  assert.equal(estatePetitionVariantFor(state, 'missing'), null);
  assert.equal(estatePetitionVariantFor({ ...state, tick: state.tick - 1000 }, petition.id), null);
  assert.equal(estatePetitionVariantFor({ ...state, tick: state.tick + 1000 }, petition.id), null);
});

test('041 leaves the existing grant/refuse effects and exactly-once response intact', () => {
  for (const grant of [true, false]) {
    const state = fixture();
    const expected = answerEstatePetition(state, 'pannage-real', grant);
    assert.ok(estatePetitionVariantFor(state, 'pannage-real'));
    const actual = answerEstatePetition(state, 'pannage-real', grant);
    assert.deepEqual(actual, expected);
    assert.equal(estatePetitionVariantFor(actual, 'pannage-real'), null);
    assert.equal(answerEstatePetition(actual, 'pannage-real', !grant), actual);
  }
});


test('041 pins the exact petition and rejects forged context or substituted groups', () => {
  const state = fixture();
  const context = woodlandPetitionContext(state, bound);
  assert.ok(context);
  assert.deepEqual(woodlandPetitionContext(state, bound, context), context);
  assert.equal(woodlandPetitionContext(state, bound, { ...context, subjectKey: 'another-petition' }), null);
  assert.equal(woodlandPetitionContext(state, bound, { ...context, partyIds: ['merchants'] }), null);
  assert.equal(woodlandPetitionContext(state, bound, {}), null);
  assert.ok(state.stewardship);
  const petition = state.stewardship.petitions[0];
  assert.ok(petition);
  const withEarlier = { ...state, stewardship: { ...state.stewardship, petitions: [{ ...petition, id: 'aaa-other' }, petition] } };
  assert.equal(estatePetitionVariantFor(withEarlier, petition.id)?.occurrenceId, petition.id);
});


test('041 world facts are independent of date; the copy API applies canonical inclusive years and seasons', () => {
  const state = fixture();
  assert.ok(state.stewardship);
  const petition = state.stewardship.petitions[0];
  assert.ok(petition);
  for (const year of [1300, 1450, 1451]) {
    const tick = (year - scenarioOf(state).startYear) * 4000 + 2000;
    const dated: GameState = { ...state, tick, stewardship: { ...state.stewardship,
      petitions: [{ ...petition, tick, deadline: tick + 1000 }] } };
    assert.ok(woodlandPetitionContext(dated, bound));
    assert.equal(estatePetitionVariantFor(dated, petition.id) !== null, year <= 1450);
  }
  const entry = v4Entry('ck_evt_041');
  assert.ok(entry);
  const saved = entry.calendar;
  const current = stateCalendar(state);
  try {
    for (const calendar of [
      { ...saved, yearMinInclusive: current.year + 1 },
      { ...saved, yearMaxInclusive: current.year - 1 },
      { ...saved, seasonIndices: saved.seasonIndices.filter(season => season !== current.season) },
    ]) {
      assert.ok(Reflect.set(entry, 'calendar', calendar));
      assert.ok(woodlandPetitionContext(state, bound));
      assert.equal(estatePetitionVariantFor(state, petition.id), null);
    }
  } finally { Reflect.set(entry, 'calendar', saved); }
  assert.ok(estatePetitionVariantFor(state, petition.id));
});
