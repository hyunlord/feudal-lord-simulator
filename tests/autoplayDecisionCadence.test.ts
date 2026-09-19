import assert from 'node:assert/strict';
import test from 'node:test';
import { createAutoplayTraceDriver } from '../scripts/economyHarnessAutoplay';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';

test('Given an idle advisor decision When resources change before120ticks Then the trace waits for the next decision pulse', () => {
  const driver = createAutoplayTraceDriver();
  const start = { ...structuredClone(DEFAULT_GAME_STATE), treasuryTimber: 500 };
  assert.equal(driver.apply(start), start);
  const beforePulse = { ...start, tick: 119, treasuryTimber: 120 };
  assert.equal(driver.apply(beforePulse), beforePulse);
  assert.equal(driver.appliedActions.length, 0);
  const pulse = driver.apply({ ...beforePulse, tick: 120 });
  assert.equal(driver.appliedActions.length, 1);
  assert.ok(pulse.constructionSites.some(site => site.kind === 'sawmill'));
});
