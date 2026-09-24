import assert from 'node:assert/strict';
import test from 'node:test';

import { decideNextAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { reserveDeadlockFixture } from './reserveDeadlockFixture';

test('a timber reserve deadlock makes autoplay select the existing construction-priority action', () => {
  const state = reserveDeadlockFixture();

  const decision = decideNextAction(state);
  assert.deepEqual(decision, { kind: 'set_wall_construction_priority', priority: 'priority' });
  assert.deepEqual(autoplayActionToGameAction(decision), { type: 'set_wall_construction_priority', priority: 'priority' });
});
