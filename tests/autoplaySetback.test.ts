import { canPlaceBuilding } from '../src/world/placement';
import { createPalisadeConstructionSite } from '../src/economy/construction';
import { formatPlacementFailure } from '../src/render/placementFeedback';
import assert from 'node:assert/strict';
import test from 'node:test';
import { hasAutoplayBuildingClearance } from '../src/engine/autoplaySetback';
import { decideNextAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { DEFAULT_GAME_STATE, gameReducer } from '../src/state/gameStore';

function ground() {
  const state = structuredClone(DEFAULT_GAME_STATE);
  state.width = 12;
  state.height = 12;
  state.palisade = null;
  state.tiles = Array.from({ length: 144 }, (_, index) => ({
    tx: index % 12, ty: Math.floor(index / 12), terrain: 'grass' as const,
    hasRoad: false, buildingId: null,
  }));
  return state;
}

for (const offset of [{ tx: 3, ty: 4 }, { tx: 3, ty: 3 }, { tx: 6, ty: 6 }]) {
  test(`Given a 2x2 automatic site near water at ${offset.tx},${offset.ty} Then its entire dry perimeter is reserved`, () => {
    const state = ground();
    state.tiles = state.tiles.map(tile => tile.tx === offset.tx && tile.ty === offset.ty ? { ...tile, terrain: 'water' } : tile);
    assert.equal(hasAutoplayBuildingClearance(state, 'wheat_farm', { tx: 4, ty: 4 }), false);
    assert.equal(hasAutoplayBuildingClearance(state, 'wheat_farm', { tx: 8, ty: 8 }), true);
  });
}

test('Given a map edge Then the advisor reserves a full land ring instead of trapping the future wall', () => {
  assert.equal(hasAutoplayBuildingClearance(ground(), 'house', { tx: 0, ty: 4 }), false);
  assert.equal(hasAutoplayBuildingClearance(ground(), 'house', { tx: 1, ty: 4 }), true);
});

test('Given the default start When the advisor builds Then the legal reducer action preserves a dry perimeter', () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  const action = decideNextAction(state);
  assert.equal(action.kind, 'place_building');
  if (action.kind !== 'place_building') return;
  assert.equal(hasAutoplayBuildingClearance(state, action.building, action), true);
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command);
  assert.notEqual(gameReducer(state, command), state);
});

for (const completed of [false, true]) for (const axis of ['x', 'y'] as const) {
  test(`Given a ${completed ? 'complete' : 'planned'} ${axis} wall Then automatic houses leave its one-tile setback on either side`, () => {
    const state = ground();
    const path = axis === 'x' ? [{ x: 5, y: 2 }, { x: 5, y: 10 }] : [{ x: 2, y: 5 }, { x: 10, y: 5 }];
    state.palisade = { id: 'wall', gate: { x: 5, y: 5 }, polygon: path, segments: [{ id: 'segment', order: 0, edgePath: path, tileCount: 8, completed, constructionSiteId: null }] };
    const coordinate = (offset: number) => axis === 'x' ? { tx: offset, ty: 6 } : { tx: 6, ty: offset };
    for (const touching of [4, 5]) assert.equal(hasAutoplayBuildingClearance(state, 'house', coordinate(touching)), false);
    for (const clear of [3, 6]) assert.equal(hasAutoplayBuildingClearance(state, 'house', coordinate(clear)), true);
  });
}

test('Given a narrow coast at the first candidate When the advisor chooses a well Then it moves inland and remains buildable', () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  const first = decideNextAction(state);
  assert.equal(first.kind, 'place_building');
  if (first.kind !== 'place_building') return;
  state.tiles = state.tiles.map(tile => tile.tx === first.tx - 1 && tile.ty === first.ty - 1 ? { ...tile, terrain: 'water' } : tile);
  const action = decideNextAction(state);
  assert.equal(action.kind, 'place_building');
  if (action.kind !== 'place_building') return;
  assert.notDeepEqual(action, first);
  assert.equal(hasAutoplayBuildingClearance(state, action.building, action), true);
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command);
  assert.notEqual(gameReducer(state, command), state);
});


for (const completed of [false, true]) test(`Given a ${completed ? 'complete' : 'planned'} wall When manually placing a building Then it cannot touch or cross the wall`, () => {
  const state = ground();
  state.buildings = [];
  state.constructionSites = [];
  state.treasuryTimber = 1000;
  const path = [{ x: 5, y: 2 }, { x: 5, y: 10 }];
  state.palisade = { id: 'wall', gate: { x: 5, y: 5 }, polygon: path, segments: [{ id: 'segment', order: 0, edgePath: path, tileCount: 8, completed, constructionSiteId: null }] };
  for (const tx of [4, 5]) {
    const result = canPlaceBuilding(state, 'house', tx, 6);
    assert.deepEqual(result, { ok: false, reason: 'wall_clearance' });
    if (!result.ok) assert.match(formatPlacementFailure({ reason: result.reason, buildingKind: 'house' }), /성벽.*1칸/);
    assert.equal(gameReducer(state, { type: 'place_building', kind: 'house', tx, ty: 6 }), state);
  }
  for (const tx of [3, 6]) assert.equal(canPlaceBuilding(state, 'house', tx, 6).ok, true);
});

test('Given an independent wall construction site When placing a farm across its path Then the planned wall is protected', () => {
  const state = ground();
  state.buildings = [];
  state.constructionSites = [createPalisadeConstructionSite({ id: 'site', wallId: 'wall', segmentIndex: 0, gateDistance: 0, order: 0, path: [{ x: 5, y: 4 }, { x: 5, y: 6 }], startedTick: 0 })];
  state.treasuryTimber = 1000;
  assert.deepEqual(canPlaceBuilding(state, 'wheat_farm', 4, 4), { ok: false, reason: 'wall_clearance' });
});

test('Given a shore-adjacent legal lot without a wall When placing manually Then automatic coastline preferences do not restrict the player', () => {
  const state = ground();
  state.buildings = [];
  state.constructionSites = [];
  state.treasuryTimber = 1000;
  state.tiles = state.tiles.map(tile => tile.tx === 3 ? { ...tile, terrain: 'water' } : tile);
  assert.equal(canPlaceBuilding(state, 'house', 4, 4).ok, true);
  assert.equal(hasAutoplayBuildingClearance(state, 'house', { tx: 4, ty: 4 }), false);
});

for (const path of [
  [{ x: 2, y: 5 }, { x: 10, y: 5 }],
  [{ x: 2, y: 2 }, { x: 10, y: 10 }],
  [{ x: 2, y: 10 }, { x: 10, y: 2 }],
]) test(`Given wall path ${JSON.stringify(path)} Then a crossing farm is rejected by the actual reducer`, () => {
  const state = ground();
  state.buildings = [];
  state.constructionSites = [];
  state.treasuryTimber = 1000;
  state.palisade = { id: 'wall', gate: { x: 5, y: 5 }, polygon: path, segments: [{ id: 'segment', order: 0, edgePath: path, tileCount: 8, completed: true, constructionSiteId: null }] };
  assert.deepEqual(canPlaceBuilding(state, 'wheat_farm', 5, 5), { ok: false, reason: 'wall_clearance' });
  assert.equal(gameReducer(state, { type: 'place_building', kind: 'wheat_farm', tx: 5, ty: 5 }), state);
});
