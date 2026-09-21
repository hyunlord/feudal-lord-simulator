import assert from 'node:assert/strict';
import test from 'node:test';
import { observedMaterialTown } from './autoplayMaterialPolicyFixtures';
import { materialRecoveryAction } from '../src/engine/autoplayMaterialRecovery';
import { waterAction } from '../src/engine/autoplayWater';
import { decideNextAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { gameReducer } from '../src/state/gameStore';
import type { GameState } from '../src/engine/engine.types';

test('Given a qualified material expansion and a waterless home When public autoplay decides Then executable food construction wins without spending the material episode', () => {
  const base = observedMaterialTown();
  const state: GameState = { ...base,
    buildings: base.buildings.filter(home => home.id !== 'water'),
    tiles: base.tiles.map(tile => tile.buildingId === 'water' ? { ...tile, buildingId: null } : tile),
    houses: base.houses.map(home => ({ ...home, hasWater: false })), pathCache: {} };
  const material = materialRecoveryAction(state);
  assert.ok(material.kind === 'place_building' && material.building === 'masonry', JSON.stringify(material));
  const water = waterAction(state);
  assert.ok(water.kind === 'place_building' && water.building === 'well', JSON.stringify(water));
  const action = decideNextAction(state, { maxHousingLots: 1 });
  assert.ok(action.kind === 'place_building' && action.building === 'wheat_farm', JSON.stringify(action));
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command);
  const next = gameReducer(state, command);
  assert.equal(next.constructionSites.filter(site => site.kind === 'wheat_farm').length, 1);
  assert.equal(next.constructionSites.filter(site => site.kind === 'masonry').length, 0);
  assert.deepEqual(next.autoplayMaterialRecovery, state.autoplayMaterialRecovery);
});
