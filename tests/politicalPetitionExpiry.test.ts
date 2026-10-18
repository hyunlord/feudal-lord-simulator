import assert from 'node:assert/strict';
import test from 'node:test';
import { BALANCE } from '../src/content/balanceConfig';
import { PETITION_DEFS } from '../src/content/chapterConfig';
import { GREAT_FAMINE_EVENT_ID } from '../src/content/eventConfig';
import { SCENARIOS, scenarioById } from '../src/content/scenario/registry';
import type { GameState } from '../src/engine/engine.types';
import { advancePolitics, initialPolitics, politicalPetitionExpiryTick } from '../src/engine/politics';
import type { PetitionRecord } from '../src/engine/politics.types';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';

const petition: PetitionRecord = { id: 'expiry-market', defId: 'market_charter', petitioner: 'merchants', arrivedTick: 20000 };
function stateAt(tick: number, scenarioId?: string): GameState {
  const base: GameState = { ...structuredClone(DEFAULT_GAME_STATE), tick, ...(scenarioId === undefined ? {} : { scenarioId }) };
  return { ...base, politics: { ...initialPolitics(base), petitions: [petition] } };
}

test('calendar cutoff is the first tick of the year after toYear and expires exactly once', () => {
  const before = stateAt(9 * BALANCE.TICKS_PER_YEAR - 1);
  const expiry = politicalPetitionExpiryTick(before, petition);
  assert.equal(expiry, 36000);
  assert.equal(advancePolitics(before).politics?.petitions[0]?.response, undefined);
  const at = advancePolitics({ ...before, tick: 36000 });
  assert.equal(at.politics?.petitions[0]?.response, 'expired');
  assert.equal(at.politics?.petitions[0]?.respondedTick, 36000);
  assert.equal(at.politics?.merchantGauge, (before.politics?.merchantGauge ?? 0) - 10);
  assert.deepEqual(advancePolitics({ ...at, tick: 36050 }).politics?.petitions, at.politics?.petitions);
  assert.equal(advancePolitics({ ...at, tick: 36050 }).politics?.merchantGauge, at.politics?.merchantGauge);
});

test('reading expiry is pure and does not depend on current tick or answer status', () => {
  const state = stateAt(20000);
  const unchanged = structuredClone(state), originalPetition = structuredClone(petition);
  assert.equal(politicalPetitionExpiryTick(state, petition), 36000);
  const answered: PetitionRecord = { ...petition, response: 'refuse' };
  assert.equal(politicalPetitionExpiryTick(stateAt(40000), answered), 36000);
  assert.deepEqual(state, unchanged);
  assert.deepEqual(petition, originalPetition);
});

test('sequence-triggered and unknown petitions have no calendar expiry', () => {
  const state = stateAt(700000);
  const sequence = PETITION_DEFS.filter(def => (def.trigger ?? 'calendar') !== 'calendar');
  assert.ok(sequence.length > 0);
  for (const def of sequence) assert.equal(politicalPetitionExpiryTick(state, { defId: def.id }), null, def.id);
  assert.equal(politicalPetitionExpiryTick(state, { defId: 'not-a-definition' }), null);
  assert.equal(politicalPetitionExpiryTick(state, { defId: 'ck_evt_057' }), null, 'registry-specific expiry belongs to its own reader');
});

test('cutoff follows the scenario start year and an inactive politics event has no expiry', () => {
  const source = scenarioById(undefined);
  const offset = 'expiry_test:offset', inactive = 'expiry_test:inactive', late = 'expiry_test:late';
  SCENARIOS.register({ ...source, id: offset, startYear: 1302 });
  SCENARIOS.register({ ...source, id: inactive, activeEvents: source.activeEvents.filter(id => id !== GREAT_FAMINE_EVENT_ID) });
  SCENARIOS.register({ ...source, id: late, startYear: 1310 });
  const before = stateAt(27999, offset);
  assert.equal(politicalPetitionExpiryTick(before, petition), 28000);
  assert.equal(advancePolitics(before).politics?.petitions[0]?.response, undefined);
  assert.equal(advancePolitics({ ...before, tick: 28000 }).politics?.petitions[0]?.response, 'expired');
  assert.equal(politicalPetitionExpiryTick(stateAt(0, late), petition), 0);
  assert.equal(advancePolitics(stateAt(0, late)).politics?.petitions[0]?.response, 'expired');
  const stopped = stateAt(40000, inactive);
  assert.equal(politicalPetitionExpiryTick(stopped, petition), null);
  assert.equal(advancePolitics(stopped), stopped);
});
