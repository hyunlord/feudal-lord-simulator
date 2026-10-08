import { weighOffer } from '../src/engine/decisionLayer';
import { stateCalendar } from '../src/engine/scenarioState';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { V4_COPY } from '../src/content/registry/v4Copy.generated';
import type { GameState } from '../src/engine/engine.types';
import { estatesOf } from '../src/engine/estates';
import { answerRegistryOffer, initialRegistry, offerChoices, openRegistryOffers } from '../src/engine/registry';
import type { RegistryOccurrence } from '../src/engine/registry.types';
import { bindEntry, boundIdentities, v4Candidates, v4Entry } from '../src/engine/registryV4';
import { registryVariantFor } from '../src/engine/registryVariants';
import { EMPTY_STEWARDSHIP } from '../src/engine/stewardship';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave, encodeSave } from '../src/save/saveCodec';

function offered(entryId: string): { readonly state: GameState; readonly occurrence: RegistryOccurrence } {
  const base = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const person = base.persons?.people[0];
  const original = estatesOf(base).estates[0];
  assert.ok(person && original);
  const estates = Array.from({ length: 12 }, (_, index) => ({ ...original, id: `estate-${index}`, offMap: true,
    titleHolder: 'lord', possessor: 'lord', pieces: original.pieces.map(piece => ({ ...piece, titleHolder: 'lord', possessor: 'lord' })) }));
  const estate = estates[0];
  assert.ok(estate);
  const current = { personId: 'current', estateId: estate.id, ability: 40, loyalty: 40, disposition: 'greedy' as const, connection: null, since: 0, kept: 0, errors: 0, status: 'serving' as const };
  const able = { ...current, personId: 'able', ability: 80, loyalty: 20, disposition: 'merchant' as const, status: 'candidate' as const };
  const loyal = { ...current, personId: 'loyal', ability: 20, loyalty: 80, disposition: 'peasant' as const, status: 'candidate' as const };
  const oversight = estates.map(item => ({ estateId: item.id, mode: entryId === 'ck_evt_031' ? 'steward' as const : 'direct' as const,
    stewardId: current.personId, auditMode: 'accounts' as const, tenants: 0, merchants: 0, undetected: 0, since: 0 }));
  const state: GameState = { ...base, agency: initialAgency(), registry: initialRegistry(),
    estates: { ...estatesOf(base), estates, people: [current, able, loyal].map(item => ({ ...person, id: item.personId, alive: true, birthYear: 1270 })) },
    stewardship: { ...EMPTY_STEWARDSHIP, stewards: [current, able, loyal], oversight } };
  const entry = v4Entry(entryId);
  assert.ok(entry);
  const bound = bindEntry(state, entry);
  assert.ok(bound, entryId);
  const occurrence: RegistryOccurrence = { id: `variant-test:${entryId}`, entryId, source: 'v4', boundId: estate.id,
    offeredTick: state.tick, deadline: state.tick + 1000, status: 'offered', bound: boundIdentities(bound),
    receipt: { draw: 0, chancePermille: 1000, conditions: [] } };
  return { state: { ...state, registry: { ...initialRegistry(), occurrences: [occurrence] } }, occurrence };
}

for (const [source, variant] of [['ck_evt_031', 'ck_evt_067'], ['ck_evt_059', 'ck_evt_067'], ['ck_evt_019', 'ck_evt_078']]) {
  test(`ER-13 ${variant} decorates only the fixed ${source} occurrence without changing choices or state`, () => {
    assert.ok(source && variant);
    const { state, occurrence } = offered(source);
    const before = JSON.stringify(state);
    const choices = offerChoices(state, occurrence);
    assert.ok(weighOffer(state, occurrence)?.weights.includes('land'));
    assert.ok(choices.length >= 2);
    const expectedAnswer = answerRegistryOffer(state, occurrence.id, choices[0] ?? "");
    const view = registryVariantFor(state, occurrence);
    assert.deepEqual(view, { occurrenceId: occurrence.id, sourceEntryId: source, variantEntryId: variant,
      title: V4_COPY[variant]?.title, body: V4_COPY[variant]?.body });
    assert.deepEqual(offerChoices(state, occurrence), choices);
    assert.deepEqual(answerRegistryOffer(state, occurrence.id, choices[0] ?? ""), expectedAnswer);
    assert.equal(JSON.stringify(state), before);
    assert.ok(!v4Candidates(state, []).some(item => item.entry.id === variant));
    const loaded = decodeSave(encodeSave({ state, createdAt: "2026-10-06T00:00:00Z", savedAt: "2026-10-06T00:00:00Z" }).bytes).envelope.state;
    assert.deepEqual(registryVariantFor(loaded, occurrence), view);
  });
}

test('ER-13 rejects missing fixed parties instead of silently choosing replacements', () => {
  const { state, occurrence } = offered('ck_evt_031');
  assert.ok(state.estates && state.stewardship && occurrence.bound);
  const missing = { ...state, estates: { ...state.estates, people: state.estates.people.filter(person => person.id !== 'able') } };
  assert.equal(registryVariantFor(missing, occurrence), null);
  const partial = { ...occurrence, bound: { estate: occurrence.bound.estate ?? '' } };
  assert.equal(registryVariantFor({ ...state, registry: { ...initialRegistry(), occurrences: [partial] } }, partial), null);
  assert.equal(registryVariantFor({ ...state, registry: initialRegistry() }, occurrence), null);
  assert.equal(registryVariantFor({ ...state, tick: occurrence.deadline + 1 }, occurrence), null);
  const answered = { ...occurrence, status: 'answered' as const };
  assert.equal(registryVariantFor({ ...state, registry: { ...initialRegistry(), occurrences: [answered] } }, answered), null);
});

test('ER-13 variant remains available through the original offer inclusive deadline', () => {
  const { state, occurrence } = offered('ck_evt_031');
  const atDeadline = { ...occurrence, deadline: state.tick };
  const current = { ...state, registry: { ...initialRegistry(), occurrences: [atDeadline] } };
  assert.equal(openRegistryOffers(current).length, 1);
  const choice = offerChoices(current, atDeadline)[0];
  assert.ok(choice);
  assert.equal(answerRegistryOffer(current, atDeadline.id, choice).registry?.occurrences[0]?.status, 'answered');
  assert.deepEqual(registryVariantFor(current, atDeadline), registryVariantFor(state, occurrence));
  const expired = { ...current, tick: current.tick + 1 };
  assert.equal(openRegistryOffers(expired).length, 0);
  assert.equal(registryVariantFor(expired, atDeadline), null);
});

test('ER-13 new better-ranked candidates cannot replace the occurrence parties', () => {
  const { state, occurrence } = offered('ck_evt_031');
  assert.ok(state.estates && state.stewardship);
  const person = state.estates.people.find(item => item.id === 'able');
  const steward = state.stewardship.stewards.find(item => item.personId === 'able');
  assert.ok(person && steward);
  const before = registryVariantFor(state, occurrence);
  const changed: GameState = { ...state, estates: { ...state.estates, people: [{ ...person, id: 'a-new-able' }, ...state.estates.people] },
    stewardship: { ...state.stewardship, stewards: [{ ...steward, personId: 'a-new-able', ability: 100 }, ...state.stewardship.stewards] } };
  assert.deepEqual(registryVariantFor(changed, occurrence), before);
  assert.ok(changed.estates);
  const withoutOriginal = { ...changed, estates: { ...changed.estates, people: changed.estates.people.filter(item => item.id !== 'able') } };
  assert.equal(registryVariantFor(withoutOriginal, occurrence), null);
  const noConditions = { ...state, stewardship: { ...state.stewardship, oversight: state.stewardship.oversight.map(item => ({ ...item, mode: 'direct' as const })) } };
  assert.equal(registryVariantFor(noConditions, occurrence), null);
  const blocked = { ...occurrence, entryId: 'ck_evt_064' };
  assert.equal(registryVariantFor({ ...state, registry: { ...initialRegistry(), occurrences: [blocked] } }, blocked), null);
});

test('ER-13 variant-specific authored context is required even when original conditions hold', () => {
  const { state, occurrence } = offered('ck_evt_031');
  assert.ok(state.estates);
  const changed: GameState = { ...state, estates: { ...state.estates,
    people: state.estates.people.map(person => person.id === 'current' ? { ...person, birthYear: 1450 } : person) } };
  const source = v4Entry(occurrence.entryId);
  assert.ok(source && bindEntry(changed, source, occurrence.bound));
  assert.equal(registryVariantFor(changed, occurrence), null);
});


for (const source of ['ck_evt_031', 'ck_evt_019']) {
  test(`ER-13 ${source} copy API obeys variant calendar independently of its condition AST`, () => {
    const { state, occurrence } = offered(source);
    const view = registryVariantFor(state, occurrence);
    assert.ok(view);
    const variant = v4Entry(view.variantEntryId);
    assert.ok(variant);
    const saved = variant.calendar;
    const current = stateCalendar(state);
    try {
      for (const calendar of [
        { ...saved, yearMinInclusive: current.year + 1 },
        { ...saved, yearMaxInclusive: current.year - 1 },
        { ...saved, seasonIndices: saved.seasonIndices.filter(season => season !== current.season) },
      ]) {
        assert.ok(Reflect.set(variant, 'calendar', calendar));
        assert.equal(registryVariantFor(state, occurrence), null);
      }
    } finally { Reflect.set(variant, 'calendar', saved); }
    assert.deepEqual(registryVariantFor(state, occurrence), view);
  });
}
