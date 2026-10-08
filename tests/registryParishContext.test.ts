import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BUILDING_CONFIG_BY_KIND } from '../src/content/buildingConfig';
import type { GameState } from '../src/engine/engine.types';
import { parishContext } from '../src/engine/registryParishContext';
import { bindEntry, boundIdentities, contextKey, dedupKey, registryV4Support, runCommands, v4Candidates, v4EnabledChoices, v4Entry } from '../src/engine/registryV4';
import { stateCalendar } from '../src/engine/scenarioState';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave } from '../src/save/saveCodec';

function parish(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const person = state.persons?.people[0];
  const house = state.houses.find(item => item.residents > 0);
  const building = state.buildings.find(item => item.id === house?.buildingId);
  assert.ok(person && house && building);
  const { abandonedTick: _abandoned, ...occupied } = house;
  return { ...state, agency: initialAgency(), houses: [occupied],
    buildings: [{ ...building, tx: 2, ty: 2 }, { ...building, id: 'parish-church', kind: 'church', tx: 5, ty: 2 }],
    persons: { people: [{ ...person, id: 'parish-head', householdId: house.buildingId, alive: true, role: 'head',
      birthYear: stateCalendar(state).year - 18 }], past: [], nextOrdinal: 2 } };
}

test('050 retains parish identity and raw policy semantics while indirect choices are held', () => {
  const state = parish();
  const entry = v4Entry('ck_evt_050');
  assert.ok(entry);
  const bound = bindEntry(state, entry);
  assert.ok(bound);
  const identity = boundIdentities(bound);
  assert.ok(contextKey(entry, bound).includes('parish:'));
  assert.ok(dedupKey(entry, bound).includes('parish:'));
  const choices = v4EnabledChoices(state, entry, bound);
  assert.deepEqual(choices, []);
  const support = registryV4Support().find(item => item.id === entry.id);
  assert.equal(support?.runs, false);
  assert.ok(!v4Candidates(state, []).some(candidate => candidate.entry.id === entry.id));
  assert.match(support?.reason ?? '', /^held [(]DEC-TRACE[)]/);
  const outcomes = entry.choices.filter(choice => choice.id !== state.agency?.policy).map(({ id }) => {
    const choice = entry.choices.find(item => item.id === id);
    assert.ok(choice);
    const outcome = runCommands(state, choice.commands, { state, bound, vars: {} });
    assert.ok(outcome);
    assert.equal(outcome.agency?.policy, id);
    assert.deepEqual(bindEntry(outcome, entry, identity)?.authoredContext, bound.authoredContext);
    return outcome.agency?.policy;
  });
  assert.equal(new Set(outcomes).size, 2);
});

test('parish advisory binds an actual adult household head and nearby completed church', () => {
  const state = parish();
  const before = JSON.stringify(state);
  const result = parishContext(state);
  assert.ok(result);
  assert.deepEqual(result.partyIds, ['parish-head']);
  assert.deepEqual(result.materialBefore, { policy: state.agency?.policy });
  assert.equal(JSON.stringify(state), before);
});

test('parish advisory rejects missing church and homes outside the existing church service radius', () => {
  const state = parish();
  assert.equal(parishContext({ ...state, buildings: state.buildings.filter(item => item.kind !== 'church') }), null);
  assert.equal(parishContext({ ...state, buildings: state.buildings.map(item => item.kind === 'church'
    ? { ...item, tx: 20 + BUILDING_CONFIG_BY_KIND.church.serviceRadius } : item) }), null);
});

test('parish advisory rejects dead, absent and underage representatives', () => {
  const state = parish();
  assert.ok(state.persons);
  for (const alteration of [{ alive: false }, { leftYear: stateCalendar(state).year },
    { birthYear: stateCalendar(state).year - 17 }, { role: 'child' as const }, { householdId: 'manor' }]) {
    assert.equal(parishContext({ ...state, persons: { ...state.persons,
      people: state.persons.people.map(person => ({ ...person, ...alteration })) } }), null);
  }
});

test('fixed parish advisory retains observed policy while current policy changes', () => {
  const state = parish();
  const fixed = parishContext(state);
  assert.ok(fixed && state.agency);
  assert.deepEqual(parishContext({ ...state, agency: { ...state.agency, policy: 'revenue' } }, fixed), fixed);
});

test('fixed parish advisory cannot silently substitute another representative or church', () => {
  const state = parish();
  const fixed = parishContext(state);
  assert.ok(fixed && state.persons);
  const replacement = { ...state, persons: { ...state.persons,
    people: state.persons.people.map(person => ({ ...person, id: 'new-head' })) } };
  assert.ok(parishContext(replacement));
  assert.equal(parishContext(replacement, fixed), null);
  const rebuilt = { ...state, buildings: state.buildings.map(item => item.kind === 'church' ? { ...item, id: 'rebuilt-church' } : item) };
  assert.ok(parishContext(rebuilt));
  assert.equal(parishContext(rebuilt, fixed), null);
});

test('fixed parish advisory expires when its head dies or home ceases to be inhabited', () => {
  const state = parish();
  const fixed = parishContext(state);
  assert.ok(fixed && state.persons);
  assert.equal(parishContext({ ...state, persons: { ...state.persons,
    people: state.persons.people.map(person => ({ ...person, alive: false })) } }, fixed), null);
  assert.equal(parishContext({ ...state, houses: state.houses.map(home => ({ ...home, residents: 0 })) }, fixed), null);
  assert.equal(parishContext({ ...state, houses: state.houses.map(home => ({ ...home, burntTick: state.tick })) }, fixed), null);
  const { agency: _agency, ...sandbox } = state;
  assert.equal(parishContext(sandbox, fixed), null);
});
