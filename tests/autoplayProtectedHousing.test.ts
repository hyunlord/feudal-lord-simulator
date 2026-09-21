import assert from 'node:assert/strict';
import test from 'node:test';
import type { Building } from '../src/content/buildingConfig';
import { decideNextAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { preservesAutoplayWallSpace } from '../src/engine/autoplayWallSpace';
import type { GameState, PalisadeState } from '../src/engine/engine.types';
import { palisadeProtectionForBuilding } from '../src/geometry/palisadeProtection';
import { gameReducer } from '../src/state/gameStore';
import { canPlaceBuilding } from '../src/world/placement';

function building(id: string, kind: Building['kind'], tx: number, ty: number): Building {
  return { id, kind, tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
function fixture(): GameState {
  const buildings = [building('home', 'house', 6, 6), building('well', 'well', 6, 5)];
  const polygon = [{ x: 4, y: 2 }, { x: 10, y: 2 }, { x: 10, y: 10 }, { x: 4, y: 10 }, { x: 4, y: 2 }];
  return {
    tick: 0, seed: 1, width: 12, height: 12,
    tiles: Array.from({ length: 144 }, (_, index) => {
      const tx = index % 12; const ty = Math.floor(index / 12);
      return { tx, ty, terrain: 'grass', buildingId: buildings.find(b => b.tx === tx && b.ty === ty)?.id ?? null,
        hasRoad: ty === 7 && tx >= 1 && tx <= 8 };
    }),
    buildings, constructionSites: [], houses: [{ buildingId: 'home', level: 0, residents: 4, hasWater: true,
      breadStock: 20, lastServicedTick: 0, unmetRequirementTicks: 0 }], walkers: [], population: 4, idleWorkers: 7,
    treasuryTimber: 500, treasuryCoin: 0, wallTick: 0, era: 'palisade', eraProclaimedTick: 0,
    palisade: { id: 'wall', polygon, gate: { x: 4, y: 7 }, segments: [{ id: 'segment', order: 0, edgePath: polygon,
      tileCount: 28, completed: false, constructionSiteId: 'pending' }] },
    forestHarvests: [], nextConstructionOrdinal: 1, roadRevision: 1, pathCache: {},
  };
}
function wall(state: GameState): PalisadeState {
  assert.ok(state.palisade);
  return state.palisade;
}

for (const phase of ['pending', 'complete', 'stone-upgrade'] as const) {
  test(`Given an accepted ${phase} boundary When autoplay considers an exterior house Then the footprint is rejected`, () => {
    const state = fixture();
    const boundary = wall(state);
    state.era = phase === 'stone-upgrade' ? 'stone_town' : 'palisade';
    state.palisade = { ...boundary, segments: boundary.segments.map(segment => ({ ...segment,
      completed: phase !== 'pending', constructionSiteId: phase === 'pending' ? 'pending' : null,
      material: 'timber', replacementConstructionSiteId: phase === 'stone-upgrade' ? 'stone-pending' : null })) };
    const result = preservesAutoplayWallSpace(state, 'house', { tx: 1, ty: 6 });
    assert.equal(result, false);
  });
}

test('Given an unfinished accepted wall When autoplay reserves an interior house Then housing protection stays inactive', () => {
  const state = fixture();
  const home = building('candidate', 'house', 5, 6);
  const result = preservesAutoplayWallSpace(state, 'house', home);
  assert.equal(result, true);
  assert.equal(palisadeProtectionForBuilding(home, state.palisade), 'inactive');
});

test('Given a diagonal boundary When the house centre is inside but a corner is outside Then autoplay rejects it', () => {
  const state = fixture();
  state.palisade = { ...wall(state), polygon: [{ x: 2, y: 2 }, { x: 10, y: 2 }, { x: 2, y: 10 }, { x: 2, y: 2 }] };
  const result = preservesAutoplayWallSpace(state, 'house', { tx: 6, ty: 5 });
  assert.equal(result, false);
});

test('Given a footprint touching the polygon When ordinary wall clearance runs Then geometric inclusion does not grant placement', () => {
  const state = fixture();
  const origin = { tx: 4, ty: 4 };
  const inclusion = preservesAutoplayWallSpace(state, 'house', origin);
  assert.equal(inclusion, true);
  assert.equal(canPlaceBuilding(state, 'house', origin.tx, origin.ty).ok, false);
});

test('Given a legacy non-hamlet state without a boundary When autoplay considers housing Then no boundary is invented', () => {
  const state = { ...fixture(), palisade: null };
  assert.equal(preservesAutoplayWallSpace(state, 'house', { tx: 1, ty: 6 }), true);
});

test('Given an exterior facility candidate When the accepted wall is pending Then the house policy leaves it unrestricted', () => {
  assert.equal(preservesAutoplayWallSpace(fixture(), 'mill', { tx: 1, ty: 6 }), true);
});

test('Given an exterior legal house When the manual reducer places it Then autoplay policy does not restrict the player', () => {
  const state = fixture();
  const next = gameReducer(state, { type: 'place_building', kind: 'house', tx: 1, ty: 6 });
  assert.ok(next.constructionSites.some(site => site.kind === 'house' && site.tx === 1 && site.ty === 6));
});

test('Given exterior and interior sites When the real advisor decides and reducer applies Then a legal interior alternative starts', () => {
  const state = fixture();
  const action = decideNextAction(state);
  assert.ok(action.kind === 'place_building' && action.building === 'house');
  assert.ok(action.tx >= 5 && action.tx < 9 && action.ty >= 3 && action.ty < 9);
  const gameAction = autoplayActionToGameAction(action, state);
  assert.ok(gameAction);
  const next = gameReducer(state, gameAction);
  assert.ok(next.constructionSites.some(site => site.kind === 'house' && site.tx === action.tx && site.ty === action.ty));
  assert.equal(next.palisade, state.palisade);
});

test('Given an existing merged home When an exterior candidate is considered Then its extra lot does not enlarge the accepted boundary', () => {
  const state = fixture();
  state.buildings = state.buildings.map(home => home.id === 'home' ? { ...home, houseLot: 'horizontal' } : home);
  const result = preservesAutoplayWallSpace(state, 'house', { tx: 10, ty: 6 });
  assert.equal(result, false);
});
