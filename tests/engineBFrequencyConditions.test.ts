import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import type { Claim, Suit } from '../src/engine/estates.types';
import type { Person } from '../src/engine/persons.types';
import type { StewardRecord } from '../src/engine/stewardship.types';
import { estatesOf } from '../src/engine/estates';
import { EMPTY_STEWARDSHIP } from '../src/engine/stewardship';
import { initialAgency } from '../src/engine/townAgency';
import { stateCalendar } from '../src/engine/scenarioState';
import { petitionContext } from '../src/engine/registryPetitionContext';
import { decodeSave } from '../src/save/saveCodec';

function fixture() {
  const base = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const person = base.persons?.people.find(item => item.alive && item.leftYear === undefined);
  const original = estatesOf(base).estates[0];
  assert.ok(person && original);
  const estate = { ...original, id: 'lord-estate', offMap: true, titleHolder: 'lord', possessor: 'lord' };
  const clerk: Person = { ...person, id: 'est-000001', birthYear: 1280, householdId: 'steward:lord-estate',
    role: 'head', occupation: 'steward', classBand: 'clerical' };
  const manor: Person = { ...clerk, id: 'manor-clerk', householdId: 'manor', role: 'steward' };
  const steward: StewardRecord = { personId: clerk.id, estateId: estate.id, ability: 60, loyalty: 60, disposition: 'peasant',
    connection: 'commons', since: 0, kept: 0, errors: 0, status: 'serving' };
  // The lord's representative need not serve the disputed estate, which may be possessed by the defendant.
  const claim: Claim = { id: 'claim', claimant: 'lord', estateId: original.id, basis: 'old_possession',
    strength: 50, evidence: [], since: 0, status: 'suing' };
  const suit: Suit = { id: 'suit', claimId: claim.id, plaintiff: 'lord', defendant: 'neighbour_1', estateId: original.id,
    stage: 'evidence', stageSince: 10, patronSupport: 0, enforcements: 0, costs: 0 };
  const oversight = { estateId: estate.id, mode: 'steward' as const, stewardId: clerk.id,
    auditMode: 'accounts' as const, tenants: 0, merchants: 0, undetected: 0, since: 0 };
  const state: GameState = { ...base, agency: initialAgency(), persons: { people: [], past: [], nextOrdinal: 2 },
    estates: { ...estatesOf(base), estates: [original, estate], claims: [claim], suits: [suit], people: [clerk] },
    stewardship: { ...EMPTY_STEWARDSHIP, stewards: [steward], oversight: [oversight] } };
  return { state, bound: { suit, claim }, clerk, manor, steward, estate, oversight };
}

test('075 uses a real serving estate clerk when the manor clerk is absent', () => {
  const { state, bound, clerk } = fixture(); // Given
  const before = JSON.stringify(state);
  const context = petitionContext(state, 'ck_evt_075', bound); // When
  assert.deepEqual(context?.partyIds, [clerk.id]); // Then
  assert.equal(JSON.stringify(state), before);
});

test('075 preserves the existing manor clerk preference', () => {
  const { state, bound, manor } = fixture(); // Given
  const withManor: GameState = { ...state, persons: { people: [manor], past: [], nextOrdinal: 2 } };
  const context = petitionContext(withManor, 'ck_evt_075', bound); // When
  assert.deepEqual(context?.partyIds, [manor.id]); // Then
});

const invalidPeople: readonly (readonly [string, Partial<Person>])[] = [
  ['dead', { alive: false }], ['underage', { birthYear: 1299 }], ['departed', { leftYear: 1300 }],
  ['not a steward', { occupation: 'farmer' }],
];
for (const [label, change] of invalidPeople) test(`075 rejects an estate clerk who is ${label}`, () => {
  const { state, bound, clerk } = fixture(); // Given
  const invalid: GameState = { ...state, estates: { ...estatesOf(state), people: [{ ...clerk, ...change,
    ...(label === 'underage' ? { birthYear: stateCalendar(state).year - 15 } : {}) }] } };
  const context = petitionContext(invalid, 'ck_evt_075', bound); // When
  assert.equal(context, null); // Then
});

for (const status of ['candidate', 'dismissed', 'dead'] as const) test(`075 rejects a ${status} stewardship record`, () => {
  const { state, bound, steward, oversight } = fixture(); // Given
  const invalid: GameState = { ...state, stewardship: { ...EMPTY_STEWARDSHIP,
    stewards: [{ ...steward, status }], oversight: [oversight] } };
  const context = petitionContext(invalid, 'ck_evt_075', bound); // When
  assert.equal(context, null); // Then
});

for (const field of ['titleHolder', 'possessor'] as const) test(`075 rejects an estate whose ${field} is foreign`, () => {
  const { state, bound, estate } = fixture(); // Given
  const invalid: GameState = { ...state, estates: { ...estatesOf(state), estates:
    estatesOf(state).estates.map(item => item.id === estate.id ? { ...item, [field]: 'neighbour_1' } : item) } };
  const context = petitionContext(invalid, 'ck_evt_075', bound); // When
  assert.equal(context, null); // Then
});

test('075 rejects a serving record not assigned by the actual oversight', () => {
  const { state, bound, steward, oversight } = fixture(); // Given
  const invalid: GameState = { ...state, stewardship: { ...EMPTY_STEWARDSHIP,
    stewards: [steward], oversight: [{ ...oversight, stewardId: 'someone-else' }] } };
  const context = petitionContext(invalid, 'ck_evt_075', bound); // When
  assert.equal(context, null); // Then
});

test('075 does not use a foreign manor person as the lord representative', () => {
  const { state, bound, manor } = fixture(); // Given
  const invalid: GameState = { ...state, persons: { people: [{ ...manor, householdId: 'enemy-manor' }], past: [], nextOrdinal: 2 },
    estates: { ...estatesOf(state), people: [] } };
  const context = petitionContext(invalid, 'ck_evt_075', bound); // When
  assert.equal(context, null); // Then
});

test('075 keeps a fixed estate clerk even when a manor clerk later becomes available', () => {
  const { state, bound, clerk, manor } = fixture(); // Given
  const fixed = petitionContext(state, 'ck_evt_075', bound);
  assert.ok(fixed);
  const later: GameState = { ...state, persons: { people: [manor], past: [], nextOrdinal: 2 } };
  const context = petitionContext(later, 'ck_evt_075', bound, fixed); // When
  assert.deepEqual(context?.partyIds, [clerk.id]); // Then
});

test('075 cannot replace a dead fixed representative with an available manor clerk', () => {
  const { state, bound, clerk, manor } = fixture(); // Given
  const fixed = petitionContext(state, 'ck_evt_075', bound);
  assert.ok(fixed);
  const later: GameState = { ...state, persons: { people: [manor], past: [], nextOrdinal: 2 },
    estates: { ...estatesOf(state), people: [{ ...clerk, alive: false }] } };
  const context = petitionContext(later, 'ck_evt_075', bound, fixed); // When
  assert.equal(context, null); // Then
});

test('075 selects estate clerks by codepoint ID regardless of array order', () => {
  const { state, bound, clerk, steward, estate, oversight } = fixture(); // Given
  const other = { ...clerk, id: 'est-000002' };
  const otherEstate = { ...estate, id: 'other-estate' };
  const both: GameState = { ...state, estates: { ...estatesOf(state),
    people: [other, clerk], estates: [...estatesOf(state).estates, otherEstate] },
    stewardship: { ...EMPTY_STEWARDSHIP, stewards: [{ ...steward, personId: other.id, estateId: otherEstate.id }, steward],
      oversight: [{ ...oversight, estateId: otherEstate.id, stewardId: other.id }, oversight] } };
  const context = petitionContext(both, 'ck_evt_075', bound); // When
  assert.deepEqual(context?.partyIds, [clerk.id]); // Then
});
