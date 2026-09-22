import assert from 'node:assert/strict';
import test from 'node:test';
import { decideNextAction } from '../src/engine/autoplay';
import type { FoodDiagnosticCollector } from '../src/engine/autoplayFoodDiagnostic';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { gameReducer } from '../src/state/gameStore';
import { connectedHousingFixture } from './efficientHousingFixtures';

test('Given five stocked cottages without actual food history When autoplay decides Then it observes rather than inventing a wheat deficit', () => {
  const current = connectedHousingFixture(5);
  const diagnostic: FoodDiagnosticCollector = {};
  const action = decideNextAction(current, { maxHousingLots: 8 }, diagnostic);
  assert.equal(diagnostic.food?.reason, 'observation_warmup');
  assert.equal(action.kind === 'place_building' && action.building, 'house');
});

test('Given a connected stocked food chain When housing is full Then autoplay adds exactly one house', () => {
  const current = connectedHousingFixture();
  const action = decideNextAction(current);
  assert.equal(action.kind === 'place_building' && action.building, 'house');
  const command = autoplayActionToGameAction(action, current);
  assert.ok(command);
  const next = gameReducer(current, command);
  assert.notEqual(next, current);
  assert.equal(next.constructionSites.filter(site => site.kind === 'house').length, 1);
  assert.equal(next.houses.length, current.houses.length);
});

test('Given a mill is still under construction When housing is full Then autoplay waits for the pending food chain', () => {
  const current = gameReducer(connectedHousingFixture(), { type: 'place_building', kind: 'mill', tx: 8, ty: 8 });
  assert.equal(current.constructionSites.filter(site => site.kind === 'mill').length, 1);
  assert.deepEqual(decideNextAction(current), { kind: 'none' });
});
