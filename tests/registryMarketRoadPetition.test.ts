import { gameReducer } from '../src/state/gameStore';
import { petitionContext } from '../src/engine/registryPetitionContext';
import { readFixedContext } from '../src/engine/registryPetitionContextIdentity';
import { registryV4Support, v4Candidates } from '../src/engine/registryV4';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { estatePetitionVariantFor } from '../src/engine/registryVariants';
import { EMPTY_STEWARDSHIP, answerEstatePetition } from '../src/engine/stewardship';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave } from '../src/save/saveCodec';
import { buildingRoadAccessTiles } from '../src/engine/routing';

function fixture(): GameState {
  const base = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const market = base.buildings.find(building => building.kind === 'market');
  assert.ok(market);
  assert.ok(buildingRoadAccessTiles(base, market).length > 0);
  return { ...base, agency: initialAgency(), stewardship: { ...EMPTY_STEWARDSHIP, petitions: [{ id: 'road-real',
    estateId: 'estate-home', kind: 'road_bridge', group: 'tenants', amount: 30, rights: false, marriage: false,
    tick: base.tick, deadline: base.tick + 1000, status: 'open' }] } };
}

test('056 reads a real market approach and changes only the existing petition words', () => {
  const state = fixture();
  const before = JSON.stringify(state);
  const view = estatePetitionVariantFor(state, 'road-real');
  assert.equal(view?.variantEntryId, 'ck_evt_056');
  assert.equal(view?.sourceEntryId, 'home:road_bridge');
  assert.equal(view?.occurrenceId, 'road-real');
  assert.equal(JSON.stringify(state), before);
  for (const grant of [true, false]) {
    assert.ok(estatePetitionVariantFor(state, 'road-real'));
    const answered = gameReducer(state, { type: 'answer_estate_petition', petitionId: 'road-real', grant });
    assert.equal(answered.treasuryCoin, state.treasuryCoin - (grant ? 30 : 0));
    assert.deepEqual(answered.tiles, state.tiles);
    assert.deepEqual(answered.buildings, state.buildings);
    assert.deepEqual(answered.zones, state.zones);
    assert.deepEqual(answered.estates, state.estates);
    assert.equal(answered.stewardship?.petitions[0]?.status, grant ? 'granted' : 'refused');
    assert.equal(estatePetitionVariantFor(answered, 'road-real'), null);
    assert.deepEqual(gameReducer(answered, { type: 'answer_estate_petition', petitionId: 'road-real', grant: !grant }), answered);
  }
});

test('056 pins the observed market and approach rather than substituting another source', () => {
  const state = fixture();
  const bound = { estatePetition: { id: 'road-real' } };
  const context = petitionContext(state, 'ck_evt_056', bound);
  assert.ok(context);
  const pinned = readFixedContext(context);
  assert.ok(pinned);
  assert.deepEqual(petitionContext(state, 'ck_evt_056', bound, context), context);
  const market = state.buildings.find(building => building.id === pinned.triggerEvidence.marketId);
  assert.ok(market);
  const replaced = { ...state, buildings: state.buildings.map(building => building.id === market.id ? { ...building, id: 'replacement-market' } : building) };
  assert.ok(petitionContext(replaced, 'ck_evt_056', bound));
  assert.equal(petitionContext(replaced, 'ck_evt_056', bound, context), null);
  const moved = { ...state, buildings: state.buildings.map(building => building.id === market.id ? { ...building, tx: building.tx + 1 } : building) };
  assert.equal(petitionContext(moved, 'ck_evt_056', bound, context), null);
  const roadTx = pinned.triggerEvidence.roadTx, roadTy = pinned.triggerEvidence.roadTy;
  assert.equal(typeof roadTx, 'number'); assert.equal(typeof roadTy, 'number');
  const removedRoad = { ...state, tiles: state.tiles.map((tile, index) => index % state.width === roadTx && Math.floor(index / state.width) === roadTy ? { ...tile, hasRoad: false } : tile) };
  assert.equal(petitionContext(removedRoad, 'ck_evt_056', bound, context), null);
  assert.equal(petitionContext(state, 'ck_evt_056', bound, {}), null);
  assert.equal(petitionContext(state, 'ck_evt_056', bound, { ...context, subjectKey: 'substituted' }), null);
  assert.equal(petitionContext(state, 'ck_evt_056', bound, { ...context, partyIds: ['merchants'] }), null);
});

test('056 requires the actual arrival and market road, includes deadline tick, never enters independent draws', () => {
  const state = fixture();
  assert.ok(state.stewardship);
  const petition = state.stewardship.petitions[0];
  assert.ok(petition);
  for (const patch of [{ estateId: 'estate-neighbour-1' }, { kind: 'newcomer' as const }, { status: 'granted' as const },
    { reachesLord: state.tick + 1 }, { deadline: state.tick - 1 }]) {
    assert.equal(estatePetitionVariantFor({ ...state, stewardship: { ...state.stewardship, petitions: [{ ...petition, ...patch }] } }, petition.id), null);
  }
  const deadline = { ...state, tick: petition.deadline };
  assert.ok(estatePetitionVariantFor(deadline, petition.id));
  assert.equal(answerEstatePetition(deadline, petition.id, true).stewardship?.petitions[0]?.status, 'granted');
  assert.equal(estatePetitionVariantFor({ ...state, tick: petition.deadline + 1 }, petition.id), null);
  assert.equal(estatePetitionVariantFor({ ...state, buildings: state.buildings.filter(building => building.kind !== 'market') }, petition.id), null);
  assert.equal(estatePetitionVariantFor({ ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: false })) }, petition.id), null);
  const noAgency = { ...state }; delete noAgency.agency;
  assert.equal(estatePetitionVariantFor(noAgency, petition.id), null);
  assert.equal(estatePetitionVariantFor(state, 'missing'), null);
  assert.ok(!v4Candidates(state, []).some(candidate => candidate.entry.id === 'ck_evt_056'));
  assert.equal(registryV4Support().find(item => item.id === 'ck_evt_056')?.reason, "a variant of an existing occurrence's words (ER-13), not drawn");
});
