import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { decideNextAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { gameReducer } from '../src/state/gameStore';
import { needsStoneStorageRecovery } from '../src/engine/autoplayStorageRecovery';
import { createConstructionSite } from '../src/economy/construction';
import { evaluateEraRequirements } from '../src/engine/era';
import type { GameState } from '../src/engine/engine.types';

function natural(tick = 504000): GameState {
  return JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/storage-recovery/seed5-${tick}.json.gz`, import.meta.url))).toString());
}

test('Given unchanged natural full storage over 24000 ticks When the complete advisor evaluates the stone shortage Then a legal storage recovery action progresses', () => {
  const state = natural();
  const later = natural(528000);
  const stocks = (s: GameState) => s.buildings.filter(b => ['storehouse', 'masonry'].includes(b.kind)).map(b => b.inventory);
  assert.deepEqual(stocks(state), stocks(later));
  assert.equal(evaluateEraRequirements(state).find(r => r.key === 'stone')?.current, 365);
  const action = decideNextAction(state, { maxHousingLots: 24 });
  assert.ok(action.kind === 'place_building' && action.building === 'storehouse' || action.kind === 'place_road', JSON.stringify(action));
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command);
  assert.notEqual(gameReducer(state, command), state);
});


test('Given no blocked era output When storage recovery is considered Then sufficient stone, spare capacity, empty output, paused production and a pending store do not expand', () => {
  const state = natural();
  assert.equal(needsStoneStorageRecovery(state), true);
  const changed = (kind: string, change: (building: GameState['buildings'][number]) => GameState['buildings'][number]): GameState => ({
    ...state, buildings: state.buildings.map(b => b.kind === kind ? change(b) : b),
  });
  assert.equal(needsStoneStorageRecovery(changed('storehouse', b => ({ ...b, inventory: { ...b.inventory, stone: 100 } }))), false);
  assert.equal(needsStoneStorageRecovery(changed('storehouse', b => ({ ...b, inventory: {} }))), false);
  assert.equal(needsStoneStorageRecovery(changed('masonry', b => ({ ...b, inventory: { stone_raw: 20 } }))), false);
  assert.equal(needsStoneStorageRecovery(changed('masonry', b => ({ ...b, inventory: { stone: 1 } }))), false);
  assert.equal(needsStoneStorageRecovery(changed('masonry', b => ({ ...b, operationPaused: true }))), false);
  const pending = createConstructionSite({ ordinal: 99999, kind: 'storehouse', tx: 0, ty: 0, startedTick: state.tick });
  assert.equal(needsStoneStorageRecovery({ ...state, constructionSites: [pending] }), false);
});

test('Given the natural stone storage blockage When normal advisor actions and deliveries run Then the era advances within 24000 ticks without injected resources', async () => {
  const { advanceTick } = await import('../src/engine/tick');
  let state = natural();
  const started = state.tick;
  let storePlacements = 0;
  for (let elapsed = 0; elapsed < 24000 && state.era === 'palisade'; elapsed += 1) {
    if (state.tick % 120 === 0) {
      const action = decideNextAction(state, { maxHousingLots: 24 });
      const command = autoplayActionToGameAction(action, state);
      if (command !== null) {
        const next = gameReducer(state, command);
        if (next !== state && action.kind === 'place_building' && action.building === 'storehouse') storePlacements += 1;
        state = next;
      }
    }
    state = advanceTick(state);
  }
  assert.equal(storePlacements, 1);
  assert.equal(state.era, 'stone_town', `tick ${state.tick}, ${JSON.stringify(evaluateEraRequirements(state))}`);
  assert.ok(state.tick - started <= 24000);
  console.log(JSON.stringify({ storageRecoveryStarted: started, stoneTownTick: state.tick, elapsed: state.tick - started, storePlacements }));
});
