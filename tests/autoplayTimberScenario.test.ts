import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE, gameReducer } from '../src/state/gameStore';
import { advanceTick } from '../src/engine/tick';
import { decideNextAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';

test('R-T14 the default headless town expands timber production and advances palisade construction by tick 120000', () => {
  // Given the actual unmodified new game, without supplied resources or checkpoints.
  let state = structuredClone(DEFAULT_GAME_STATE);
  let expandedAt: number | null = null;
  let completedAtExpansion = 0;
  // When normal automatic decisions and engine ticks run through the probe deadline.
  for (let tick = 0; tick < 120000; tick += 1) {
    if (state.tick % 120 === 0) {
      const action = decideNextAction(state);
      const command = autoplayActionToGameAction(action, state);
      if (command !== null) {
        if (action.kind === 'place_building' && (action.building === 'logging_camp' || action.building === 'sawmill')
          && state.buildings.some(b => b.kind === action.building) && expandedAt === null) {
          expandedAt = state.tick;
          completedAtExpansion = state.palisade?.segments.filter(segment => segment.completed).length ?? 0;
        }
        state = gameReducer(state, command);
      }
    }
    state = advanceTick(state);
  }
  // Then the missing expansion action exists and normal wall deliveries make progress.
  assert.ok(expandedAt !== null && expandedAt < 120000);
  assert.ok(state.buildings.filter(b => b.kind === 'logging_camp' || b.kind === 'sawmill').length > 2);
  assert.ok((state.palisade?.segments.filter(segment => segment.completed).length ?? 0) > completedAtExpansion);
});
