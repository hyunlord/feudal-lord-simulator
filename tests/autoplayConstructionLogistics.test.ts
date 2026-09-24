import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { constructionLogisticsAction } from '../src/engine/autoplayConstructionLogistics';
import { decideNextAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import type { GameState } from '../src/engine/engine.types';
import { gameReducer } from '../src/state/gameStore';
import { resolveBuildingToConstructionSiteRoute } from '../src/engine/routing';
import { carterPathTravelCost } from '../src/agents/carterTravelCost';
import { getTile } from '../src/world/grid';
const root = '/Users/rexxa/github/feudal-lord-simulator/output/free-city-stage0-v2';
function endpoint(): GameState { return JSON.parse(readFileSync(`${root}/natural-v7/d11-final-20260921T054214Z/runs/seed3/final-state.json`, 'utf8')); }
function routeCost(state: GameState): number {
  const source = state.buildings.find(b => b.id === 'construction-site-000072');
  const target = state.constructionSites.find(s => s.id === 'palisade-000070-segment-027-stone');
  assert.ok(source && target);
  const path = resolveBuildingToConstructionSiteRoute(state, source, target).path;
  assert.ok(path);
  return carterPathTravelCost(path, tile => getTile(state, tile)?.hasRoad === true);
}
test('actual endpoint advisor builds accepted shorter construction corridor without material or queue changes', () => {
  let state = endpoint(); const original = state;
  assert.equal(routeCost(state), 28);
  for (const expected of [ { kind: 'place_road', from: { tx: 3, ty: 21 }, to: { tx: 3, ty: 21 } }, { kind: 'place_road', from: { tx: 3, ty: 22 }, to: { tx: 3, ty: 36 } } ]) {
    const action = decideNextAction(state, { maxHousingLots: 24 });
    assert.deepEqual(action, expected); const command = autoplayActionToGameAction(action, state); assert.ok(command);
    const next = gameReducer(state, command); assert.notEqual(next, state); state = next;
  }
  assert.equal(routeCost(state), 14);
  assert.equal(constructionLogisticsAction(state).kind, 'none');
  assert.deepEqual(state.buildings, original.buildings); assert.deepEqual(state.constructionSites, original.constructionSites);
  assert.equal(state.treasuryTimber, original.treasuryTimber);
});

test('real food recovery wins over an available optional material shortcut', () => {
  const original = endpoint(); const removed = new Set(original.buildings.filter(b => b.kind === 'wheat_farm').map(b => b.id));
  const state = { ...original, buildings: original.buildings.filter(b => !removed.has(b.id)),
    tiles: original.tiles.map(t => t.buildingId !== null && removed.has(t.buildingId) ? { ...t, buildingId: null } : t),
    houses: original.houses.map(h => ({ ...h, breadStock: 0 })) };
  assert.equal(constructionLogisticsAction(state).kind, 'place_road');
  const action = decideNextAction(state, { maxHousingLots: 24 });
  assert.equal(action.kind, 'place_building');
  if (action.kind === 'place_building') assert.equal(action.building, 'wheat_farm');
});

test('shared prefix still rejects the last service pad and may retain only a safe leading tile', async () => {
  const { gunzipSync } = await import('node:zlib');
  const { roadPrefixAction } = await import('../src/engine/autoplayRoadPrefix');
  const { serviceSafeRoadAction } = await import('../src/engine/autoplayServiceSpace');
  const state: GameState = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/service-space-normal-97560.json.gz', import.meta.url))).toString('utf8'));
  const blocked = serviceSafeRoadAction(state, { kind: 'place_road', from: { tx: 60, ty: 39 }, to: { tx: 60, ty: 39 } });
  assert.equal(blocked.kind, 'none');
  const prefix = roadPrefixAction({ ...state, tiles: state.tiles.map(t => t.tx === 60 && t.ty === 37 ? { ...t, hasRoad: true } : t) }, [{ tx: 60, ty: 37 }, { tx: 60, ty: 38 }, { tx: 60, ty: 39 }]);
  const safe = serviceSafeRoadAction(state, prefix);
  assert.ok(safe.kind === 'none' || (safe.kind === 'place_road' && safe.to.ty < 39));
});

test('genuine preproclamation builds the same first prefix and a shorter finite active route', async () => {
  const { confirmStoneTownProclamation } = await import('../src/engine/era');
  const before: GameState = JSON.parse(readFileSync(`${root}/v7-material-dispatch/history/pre-proclaim-state.json`, 'utf8'));
  const state = confirmStoneTownProclamation(before);
  assert.notEqual(state, before);
  assert.deepEqual(constructionLogisticsAction(state), { kind: 'place_road', from: { tx: 3, ty: 21 }, to: { tx: 3, ty: 21 } });
});
