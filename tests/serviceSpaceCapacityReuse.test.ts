import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { preservesAutoplayServiceSpace, resetAutoplayServiceSearch } from '../src/engine/autoplayServiceSpace';
import { runAutoplaySearch, runAutoplaySearchPhase, type SearchDiagnosticCollector } from '../src/engine/autoplaySearchBudget';
import { decideNextAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { gameReducer } from '../src/state/gameStore';
import type { GameState } from '../src/engine/engine.types';
import { serviceCandidate, serviceFootprint } from '../src/engine/autoplayServiceSpaceRoutes';
import { buildingFootprintDistance } from '../src/geometry/buildingDistance';
import type { Building } from '../src/content/buildingConfig';
import { findAutoplayServiceWitness } from '../src/engine/autoplayServiceSpaceWitness';

function natural(): GameState {
  return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/service-space-capacity/seed3-108000.json.gz', import.meta.url))).toString('utf8'));
}
const house = { kind: 'place_building', building: 'house', tx: 16, ty: 17 } as const;

test('Given natural seed3 with 16 full homes When a locally legal but jointly unserviceable house is proposed Then rejection is proved inside the unchanged budget', () => {
  const state = natural();
  resetAutoplayServiceSearch();
  const diagnostic: SearchDiagnosticCollector = {};
  assert.equal(runAutoplaySearch(() => runAutoplaySearchPhase(() => preservesAutoplayServiceSpace(state, house)), diagnostic), false);
  assert.equal(diagnostic.search?.reason, 'search_complete');
  assert.ok((diagnostic.search?.used ?? Infinity) <= 192);
});

test('Given natural seed3 growth stalled at 16 homes When the real advisor runs Then a legal action changes the real reducer state', () => {
  const state = natural();
  const action = decideNextAction(state, { maxHousingLots: 24 });
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command, JSON.stringify(action));
  assert.notEqual(gameReducer(state, command), state);
});

test('Given insufficient proof budget When unaffected housing could be reused Then incomplete joint proof still rejects growth', () => {
  resetAutoplayServiceSearch();
  assert.equal(runAutoplaySearch(() => preservesAutoplayServiceSpace(natural(), house), undefined, 1), false);
});

function capacityState(count: number, merged = false): GameState {
  const market = serviceCandidate('market', { tx: 8, ty: 8 }, 'market');
  const church = serviceCandidate('church', { tx: 11, ty: 8 }, 'church');
  const homes = Array.from({ length: 81 }, (_, index) => serviceCandidate('house',
    { tx: 1 + index % 9 * 2, ty: 1 + Math.floor(index / 9) * 2 }, `home-${index}`))
    .filter(home => buildingFootprintDistance(home, market) > 0 && buildingFootprintDistance(home, church) > 0
      && buildingFootprintDistance(home, market) <= 8 && buildingFootprintDistance(home, church) <= 12)
    .slice(0, count).map((home, index): Building => merged && index === 0 ? { ...home, houseLot: 'horizontal' } : home);
  return { ...natural(), width: 20, height: 20, buildings: [...homes, market, church, serviceCandidate('storehouse', { tx: 1, ty: 14 }, 'source')],
    houses: [], constructionSites: [], palisade: null,
    tiles: Array.from({ length: 400 }, (_, index) => ({ tx: index % 20, ty: Math.floor(index / 20), terrain: 'grass', buildingId: null, hasRoad: true })) };
}

test('Given exact market capacity When a twenty-fifth lot is added Then prior witnesses cannot hide displacement', () => {
  const action = { kind: 'place_building', building: 'house', tx: 7, ty: 14 } as const;
  for (const [count, expected] of [[23, true], [24, false]] as const) {
    resetAutoplayServiceSearch();
    assert.equal(preservesAutoplayServiceSpace(capacityState(count), action), expected);
  }
});

test('Given 23 houses including a merged pair When another house is added Then the two-lot demand prevents below-capacity reuse', () => {
  resetAutoplayServiceSearch();
  assert.equal(preservesAutoplayServiceSpace(capacityState(23, true), { kind: 'place_building', building: 'house', tx: 7, ty: 14 }), false);
});

test('Given a last service pad and route When construction or roads occupy them Then unaffected-witness reuse cannot authorize either loss', () => {
  const state: GameState = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/service-space-normal-97560.json.gz', import.meta.url))).toString('utf8'));
  resetAutoplayServiceSearch();
  assert.equal(preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'granary', tx: 61, ty: 40 }), false);
  assert.equal(preservesAutoplayServiceSpace(state, { kind: 'place_road', from: { tx: 60, ty: 39 }, to: { tx: 60, ty: 39 } }), false);
});

test('Given two distant groups with a joint plan When a third locally serviceable group is added Then the shared facility cap still rejects it', () => {
  const homes = [serviceCandidate('house', { tx: 1, ty: 1 }, 'a'), serviceCandidate('house', { tx: 28, ty: 1 }, 'b')];
  const buildings = [serviceCandidate('storehouse', { tx: 2, ty: 13 }, 'source'), ...homes];
  const state: GameState = { ...natural(), width: 30, height: 26, buildings, houses: [], constructionSites: [], palisade: null,
    tiles: Array.from({ length: 780 }, (_, index) => {
      const tx = index % 30; const ty = Math.floor(index / 30);
      return { tx, ty, terrain: 'grass', hasRoad: ty === 12 && tx >= 1 && tx <= 25,
        buildingId: buildings.find(building => serviceFootprint(building).some(tile => tile.tx === tx && tile.ty === ty))?.id ?? null };
    }) };
  assert.ok(homes.every(home => findAutoplayServiceWitness(state, home) !== null));
  resetAutoplayServiceSearch();
  assert.equal(preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'house', tx: 14, ty: 24 }), false);
});
