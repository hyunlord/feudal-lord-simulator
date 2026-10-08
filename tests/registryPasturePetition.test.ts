import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { estatePetitionVariantFor } from '../src/engine/registryVariants';
import { petitionContext } from '../src/engine/registryPetitionContext';
import { readFixedContext } from '../src/engine/registryPetitionContextIdentity';
import { registryV4Support, v4Candidates } from '../src/engine/registryV4';
import { EMPTY_STEWARDSHIP } from '../src/engine/stewardship';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave } from '../src/save/saveCodec';
import { gameReducer } from '../src/state/gameStore';

function fixture(): GameState {
  const base = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  assert.ok(base.factions);
  assert.ok(base.factions.factions.some(faction => faction.id === 'commons'));
  assert.ok(base.factions.factions.some(faction => faction.id === 'merchant_house_2'));
  return { ...base, agency: initialAgency(), zones: [{ id: 'zone-000001', kind: 'pasture', createdOrdinal: 1,
    strokes: [{ tool: 'brush', points: [{ x: 0.5, y: 0.5 }], radius: 1 }], membership: [0, 1] }], nextZoneOrdinal: 2,
    stewardship: { ...EMPTY_STEWARDSHIP, petitions: [{ id: 'pasture-real', estateId: 'estate-home', kind: 'common_pasture',
      group: 'tenants', amount: 0, rights: false, marriage: false, tick: base.tick, deadline: base.tick + 1000, status: 'open' }] } };
}
const bound = { estatePetition: { id: 'pasture-real' } };

test('048 decorates a real common-pasture arrival and preserves both actual answer paths', () => {
  const state = fixture(), before = JSON.stringify(state);
  const view = estatePetitionVariantFor(state, 'pasture-real');
  assert.equal(view?.variantEntryId, 'ck_evt_048');
  assert.equal(view?.sourceEntryId, 'home:common_pasture');
  assert.equal(view?.occurrenceId, 'pasture-real');
  assert.equal(JSON.stringify(state), before);
  for (const grant of [true, false]) {
    assert.ok(estatePetitionVariantFor(state, 'pasture-real'));
    const actual = gameReducer(state, { type: 'answer_estate_petition', petitionId: 'pasture-real', grant });
    assert.equal(actual.treasuryCoin, state.treasuryCoin);
    assert.deepEqual(actual.zones, state.zones);
    assert.deepEqual(actual.tiles, state.tiles);
    assert.deepEqual(actual.buildings, state.buildings);
    assert.deepEqual(actual.estates, state.estates);
    assert.equal(actual.stewardship?.petitions[0]?.status, grant ? 'granted' : 'refused');
    assert.equal(estatePetitionVariantFor(actual, 'pasture-real'), null);
    assert.deepEqual(gameReducer(actual, { type: 'answer_estate_petition', petitionId: 'pasture-real', grant: !grant }), actual);
  }
  assert.ok(!v4Candidates(state, []).some(candidate => candidate.entry.id === 'ck_evt_048'));
  assert.equal(registryV4Support().find(item => item.id === 'ck_evt_048')?.reason, "a variant of an existing occurrence's words (ER-13), not drawn");
});

test('048 pins the exact observed zone and membership and does not substitute a new pasture', () => {
  const state = fixture();
  const context = petitionContext(state, 'ck_evt_048', bound);
  assert.ok(context);
  assert.deepEqual(petitionContext(state, 'ck_evt_048', bound, context), context);
  const parsed = readFixedContext(context);
  assert.ok(parsed);
  assert.deepEqual(parsed.partyIds, ['commons', 'merchant_house_2']);
  assert.deepEqual(parsed.triggerEvidence.membership, [0, 1]);
  const zone = state.zones?.[0]; assert.ok(zone);
  const replaced = { ...state, zones: [{ ...zone, id: 'zone-000002', createdOrdinal: 2 }] };
  assert.ok(petitionContext(replaced, 'ck_evt_048', bound));
  assert.equal(petitionContext(replaced, 'ck_evt_048', bound, context), null);
  for (const membership of [[0], [0, 2], [0, 1, 2]]) {
    const changed: GameState = { ...state, zones: [{ ...zone, membership }] };
    assert.ok(petitionContext(changed, 'ck_evt_048', bound));
    assert.equal(petitionContext(changed, 'ck_evt_048', bound, context), null);
  }
  for (const membership of [[], [-1], [state.width * state.height], [0.5], [1, 0], [0, 0]]) {
    assert.equal(petitionContext({ ...state, zones: [{ ...zone, membership }] }, 'ck_evt_048', bound), null);
  }
  assert.equal(petitionContext({ ...state, zones: [] }, 'ck_evt_048', bound, context), null);
  assert.equal(petitionContext(state, 'ck_evt_048', bound, {}), null);
  assert.equal(petitionContext(state, 'ck_evt_048', bound, { ...context, partyIds: ['commons'] }), null);
  assert.equal(petitionContext(state, 'ck_evt_048', bound, { ...context, subjectKey: 'other' }), null);
});

test('048 needs both actual factions, a matching arrival and valid geometry through the inclusive deadline', () => {
  const state = fixture();
  assert.ok(state.factions); assert.ok(state.stewardship);
  const petition = state.stewardship.petitions[0]; assert.ok(petition);
  for (const id of ['commons', 'merchant_house_2']) {
    const changed: GameState = { ...state, factions: { ...state.factions, factions: state.factions.factions.filter(faction => faction.id !== id) } };
    assert.equal(petitionContext(changed, 'ck_evt_048', bound), null);
    assert.equal(estatePetitionVariantFor(changed, petition.id), null);
  }
  for (const patch of [{ estateId: 'estate-neighbour-1' }, { kind: 'newcomer' as const }, { status: 'granted' as const },
    { reachesLord: state.tick + 1 }, { deadline: state.tick - 1 }]) {
    assert.equal(estatePetitionVariantFor({ ...state, stewardship: { ...state.stewardship, petitions: [{ ...petition, ...patch }] } }, petition.id), null);
  }
  const atDeadline = { ...state, tick: petition.deadline };
  assert.ok(estatePetitionVariantFor(atDeadline, petition.id));
  assert.equal(gameReducer(atDeadline, { type: 'answer_estate_petition', petitionId: petition.id, grant: true }).stewardship?.petitions[0]?.status, 'granted');
  assert.equal(estatePetitionVariantFor({ ...state, tick: petition.deadline + 1 }, petition.id), null);
  assert.equal(estatePetitionVariantFor({ ...state, zones: [] }, petition.id), null);
  const noAgency = { ...state }; delete noAgency.agency;
  assert.equal(petitionContext(noAgency, 'ck_evt_048', bound), null);
});
