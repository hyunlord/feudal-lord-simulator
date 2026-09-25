import assert from 'node:assert/strict';
import test from 'node:test';
import { createAutoplayTraceDriver } from '../scripts/economyHarnessAutoplay';
import { DEFAULT_GAME_STATE, gameReducer } from '../src/state/gameStore';

test('Given an idle advisor decision When resources change before120ticks Then the trace waits for the next decision pulse', () => {
  const driver = createAutoplayTraceDriver();
  // AF-13: a pending granary (still a recognized food-chain site) blocks the grain decision the same way the
  // retired wheat farm used to, so the advisor has nothing else to do before the next decision pulse.
  const start = gameReducer({ ...structuredClone(DEFAULT_GAME_STATE), treasuryTimber: 500 },
    { type: 'place_building', kind: 'granary', tx: 44, ty: 37 });
  assert.ok(start.constructionSites.some(site => site.kind === 'granary'));
  assert.equal(driver.apply(start), start);
  const beforePulse = { ...start, tick: 119, treasuryTimber: 120 };
  assert.equal(driver.apply(beforePulse), beforePulse);
  assert.equal(driver.appliedActions.length, 0);
  const pulse = driver.apply({ ...beforePulse, tick: 120 });
  assert.equal(driver.appliedActions.length, 1);
  assert.ok(pulse.constructionSites.some(site => site.kind === 'sawmill'));
});
