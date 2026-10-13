import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { GameState } from '../../src/engine/engine.types';
import { estatesOf } from '../../src/engine/estates';
import { EMPTY_STEWARDSHIP } from '../../src/engine/stewardship';
import { initialAgency } from '../../src/engine/townAgency';
import { decodeSave } from '../../src/save/saveCodec';
import { bindEntry, boundIdentities, v4Entry } from '../../src/engine/registryV4';
import { initialRegistry, offerChoices, registryOf } from '../../src/engine/registry';
import { gameReducer } from '../../src/state/gameStore';
import { advanceTrace } from '../../src/engine/decisionTrace';
import { advanceHistory } from '../../src/engine/history';
export function town(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const house = state.houses.find(item => item.residents > 0);
  const person = state.persons?.people.find(item => item.alive);
  const market = state.buildings.find(item => item.kind === 'market');
  assert.ok(house && person && market);
  const { history: _history, ledger: _ledger, registry: _registry, ...opening } = state;
  return { ...opening, tick: 1000, trace: { decisions: [], acts: [] }, agency: { ...initialAgency(), duesPermille: 1200 }, persons: {
    people: [{ ...person, householdId: house.buildingId, birthYear: 1280, role: 'head', classBand: 'merchant' }], past: [], nextOrdinal: 2,
  } };
}
export function delegated(): GameState {
  const base = town(), estates = estatesOf(base), original = estates.estates[0], person = base.persons?.people[0];
  assert.ok(original && person);
  const estate = { ...original, id: 'delegated-estate', annualValue: 100, offMap: true, titleHolder: 'lord', possessor: 'lord' };
  const current = { personId: 'current', estateId: estate.id, ability: 40, loyalty: 40, disposition: 'greedy' as const,
    connection: null, since: 0, kept: 0, errors: 0, status: 'serving' as const };
  return { ...base, estates: { ...estates, estates: [estate], people: [{ ...person, id: current.personId, birthYear: 1280, alive: true }] },
    stewardship: { ...EMPTY_STEWARDSHIP, stewards: [current],
      oversight: [{ estateId: estate.id, mode: 'steward', stewardId: current.personId, auditMode: 'accounts', tenants: 0, merchants: 0, undetected: 0, since: 0 }],
      rules: { amountAtLeast: 100, rights: false, marriage: false },
      petitions: [{ id: 'small-right', estateId: estate.id, kind: 'common_dispute', group: 'tenants', amount: 10,
        rights: true, marriage: false, tick: 1, deadline: 20, status: 'granted', decidedBy: 'steward' }] } };
}

export function repairTown(): GameState {
  const base = town();
  const person = base.persons?.people[0];
  assert.ok(person);
  return { ...base, timberOrder: 0, constructionSites: [{ id: 'repair', kind: 'house', tx: 1, ty: 1,
    required: { timber: 20 }, delivered: {}, reserved: {}, builderTicks: 0, requiredBuilderTicks: 100,
    assignedBuilders: 1, stall: 'awaiting_materials', startedTick: 2, rebuildOf: person.householdId }] };
}
export function offered(state: GameState, id: string): GameState {
  const entry = v4Entry(id);
  assert.ok(entry);
  const bound = bindEntry(state, entry);
  assert.ok(bound, id);
  return { ...state, registry: { ...(state.registry ?? initialRegistry()), occurrences: [...(state.registry?.occurrences ?? []), { id: 'answer:' + id + ':' + state.tick, entryId: id,
    source: 'v4', boundId: '', bound: boundIdentities(bound), offeredTick: state.tick, deadline: state.tick + 1000,
    status: 'offered', receipt: { draw: 0, chancePermille: 1000, conditions: [] } }] } };
}

export function answer(state: GameState, id: string, choice: string) {
  const before = offered(state, id);
  const occurrence = registryOf(before).occurrences.at(-1)!;
  assert.ok(offerChoices(before, occurrence).includes(choice), `${id}:${choice} enabled`);
  const after = gameReducer(before, { type: 'answer_registry_offer', occurrenceId: occurrence.id, choiceId: choice });
  assert.equal(registryOf(after).occurrences.at(-1)?.status, 'answered');
  const own = after.history?.records.find(row => row.kind === 'decision' && !before.history?.records.some(old => old.id === row.id));
  assert.ok(own, `${id} actual decision history`);
  return { before, after, ownId: own.id };
}
export function transition(state: GameState, tick: number, advance: (state: GameState) => GameState) {
  const before = { ...state, tick };
  const actual = advance(before);
  const after = advanceTrace(before, advanceHistory(before, actual));
  return { before, actual, after };
}
export function linked(state: GameState, id: string, key: string) {
  return state.history?.records.filter(row => row.because?.some(cause => cause.decisionId === id && cause.key === key)) ?? [];
}
export function contribution(state: GameState, id: string) {
  const own = state.trace?.answers?.find(row => row.id === id);
  assert.ok(own, 'own answer contribution');
  return own;
}
export function enforcing(hold: number): GameState {
  const state = delegated(), original = estatesOf(state), estate = original.estates[0]!;
  const claim = { id: 'claim', claimant: 'lord', estateId: estate.id, basis: 'old_possession' as const,
    strength: 50, evidence: [], since: 0, status: 'suing' as const };
  const suit = { id: 'suit', claimId: claim.id, plaintiff: 'lord', defendant: 'neighbour_1', estateId: estate.id,
    stage: 'enforcing' as const, stageSince: 0, patronSupport: 0, enforcements: 0, costs: 0,
    verdict: 'plaintiff' as const, enforced: false, hold };
  return { ...state, estates: { ...original, estates: [{ ...estate, titleHolder: 'neighbour_1', possessor: 'neighbour_1' }], claims: [claim], suits: [suit] } };
}
