import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRegistryPresentationCollector } from '../scripts/registryDecisionPresentations';
import type { GameState } from '../src/engine/engine.types';
import { EMPTY_DIPLOMACY } from '../src/engine/negotiation';
import { offerChoices } from '../src/engine/registry';
import { registryOf } from '../src/engine/registry';
import { EMPTY_STEWARDSHIP } from '../src/engine/stewardship';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave } from '../src/save/saveCodec';

function fixture(): GameState {
  return decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
}

test('unanswered exposure survives disappearance; the same engine ID never becomes a second presentation', () => {
  const base = fixture();
  assert.ok(base.politics);
  const petition = { id: 'waiting', defId: 'market_charter', petitioner: 'merchants' as const, arrivedTick: base.tick, options: [] };
  const initial = { ...base, politics: { ...base.politics, petitions: [petition] } };
  const collector = createRegistryPresentationCollector();
  const before = JSON.stringify(initial);
  collector.observe(initial);
  collector.observe(initial);
  assert.equal(JSON.stringify(initial), before);
  const row = collector.snapshot().find(item => item.key === 'petition:waiting');
  assert.ok(row);
  assert.equal(row.currentlyExposed, true);
  const absent = { ...initial, tick: initial.tick + 1, politics: { ...initial.politics, petitions: [] } };
  collector.observe(absent);
  assert.equal(collector.snapshot().find(item => item.key === row.key)?.currentlyExposed, false);
  collector.observe({ ...initial, tick: initial.tick + 2 });
  const restored = collector.snapshot().filter(item => item.key === row.key);
  assert.equal(restored.length, 1);
  assert.equal(restored[0]?.firstObservedTick, initial.tick);
  assert.equal(restored[0]?.lastObservedTick, initial.tick + 2);
  assert.equal(row.lastObservedTick, initial.tick);
});

test('town payload remains one episode until disappearance or payload change', () => {
  const base = fixture();
  const state = { ...base, agency: { ...initialAgency(), requests: [{ kind: 'order_timber' as const, amount: 10 }] } };
  const collector = createRegistryPresentationCollector();
  collector.observe(state);
  collector.observe({ ...state, tick: state.tick + 1 });
  assert.equal(collector.snapshot().filter(row => row.kind === 'town_request').length, 1);
  collector.observe({ ...state, agency: { ...state.agency, requests: [] } });
  collector.observe(state);
  collector.observe({ ...state, agency: { ...state.agency, requests: [{ kind: 'order_timber', amount: 20 }] } });
  const rows = collector.snapshot().filter(row => row.kind === 'town_request');
  assert.equal(rows.length, 3);
  assert.equal(rows.filter(row => row.currentlyExposed).length, 1);
  assert.ok(rows.every(row => row.identityBasis === 'observed_episode'));
});

test('future arrival and automatically settled petitions are excluded; arrival after a tick is observed', () => {
  const base = fixture();
  const petition = { id: 'delayed', estateId: 'estate-home', kind: 'rent_relief' as const, group: 'tenants' as const, amount: 10,
    rights: false, marriage: false, tick: base.tick, reachesLord: base.tick + 1, deadline: base.tick + 100, status: 'open' as const };
  const state = { ...base, stewardship: { ...EMPTY_STEWARDSHIP, petitions: [petition,
    { ...petition, id: 'automatic', reachesLord: base.tick, status: 'granted' as const, decidedBy: 'steward' as const, precedent: true as const }] } };
  const collector = createRegistryPresentationCollector();
  collector.observe(state);
  assert.equal(collector.snapshot().filter(row => row.kind === 'estate_petition').length, 0);
  collector.observe({ ...state, tick: state.tick + 1 });
  assert.deepEqual(collector.snapshot().filter(row => row.kind === 'estate_petition').map(row => row.key), ['estate_petition:delayed']);
});

test('zero enabled registry options and independently exposed petitions remain observable', () => {
  const base = fixture();
  assert.ok(base.politics);
  const occurrence = { id: 'zero-options', entryId: 'missing-definition', boundId: '', offeredTick: base.tick, deadline: base.tick + 100,
    status: 'offered' as const, source: 'v4' as const, receipt: { draw: 0, chancePermille: 1000, conditions: [] } };
  const state = { ...base, registry: { ...registryOf(base), occurrences: [occurrence] }, politics: { ...base.politics,
    petitions: ['ck_evt_057', 'ck_evt_058'].map(defId => ({ id: `${defId}@${base.tick}`, defId, petitioner: 'merchants' as const, arrivedTick: base.tick })) } };
  assert.deepEqual(offerChoices(state, occurrence), []);
  const collector = createRegistryPresentationCollector();
  collector.observe(state);
  // Chapter lifecycle adapters are not installed in this release; upstream still exposes these petitions.
  assert.deepEqual(collector.snapshot().filter(row => row.kind === 'petition').map(row => row.key).sort(),
    ['ck_evt_057', 'ck_evt_058'].map(id => `petition:${id}@${base.tick}`));
  assert.equal(collector.snapshot().filter(row => row.key === 'registry:zero-options').length, 1);
});

test('will and audit use engine identity across command observations and preserve prior snapshots', () => {
  const base = fixture();
  const state: GameState = { ...base, diplomacy: { ...EMPTY_DIPLOMACY, marriage: { negotiationId: 'negotiation-1', groomId: 'groom', brideId: 'bride',
    estateId: 'estate', contractedTick: 0, stage: 'will_change', claimId: 'claim', events: { will_change: base.tick } } },
    stewardship: { ...EMPTY_STEWARDSHIP, audits: [{ id: 'audit-1', estateId: 'estate', tick: base.tick, stewardId: 'steward', mode: 'accounts',
      revealedKept: 1, revealedErrors: 0, hidden: 0, status: 'pending', deadline: base.tick + 10 }] } };
  const collector = createRegistryPresentationCollector();
  collector.observe(state);
  const before = collector.snapshot();
  assert.ok(before.some(row => row.key === 'will:negotiation-1'));
  assert.ok(before.some(row => row.key === 'audit:audit-1'));
  collector.observe({ ...state, diplomacy: EMPTY_DIPLOMACY, stewardship: EMPTY_STEWARDSHIP });
  assert.ok(before.every(row => row.currentlyExposed));
  assert.ok(collector.snapshot().filter(row => row.kind === 'will' || row.kind === 'audit').every(row => !row.currentlyExposed));
});

test('counter and famine are observed independently of bot choice, including unanswered deadline closure', () => {
  const base = fixture();
  const acceptance = { score: 0, reasons: [], top: [], permille: 0, tier: 'impossible' as const };
  const state: GameState = { ...base, diplomacy: { ...EMPTY_DIPLOMACY, negotiations: [{ id: 'counter-1', proposer: 'lord', counterpart: 'neighbour_1',
    purpose: 'marriage', groomId: 'groom', brideId: 'bride', terms: [], acceptance, status: 'countered',
    counter: { terms: [], changes: [], acceptance }, tick: base.tick, deadline: base.tick + 1 }] },
    events: { burning: [], records: [{ id: 'famine-1', defId: 'great_famine', kind: 'dearth', season: 0, arrivalTick: base.tick,
      endTick: base.tick + 2, losses: { burntHouses: 0, departures: 0, harvestLost: 0 } }] } };
  const collector = createRegistryPresentationCollector();
  collector.observe(state);
  collector.observe({ ...state, tick: base.tick + 1 });
  const rows = collector.snapshot().filter(row => row.kind === 'counter' || row.kind === 'famine');
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.currentlyExposed));
  collector.observe({ ...state, tick: base.tick + 2 });
  assert.ok(collector.snapshot().filter(row => row.kind === 'counter' || row.kind === 'famine').every(row => !row.currentlyExposed));
});
