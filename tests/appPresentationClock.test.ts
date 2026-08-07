import assert from "node:assert/strict";
import test from "node:test";

import { nextOnboardingPresentationCommit } from "../src/App";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { createOnboardingPresentationState } from "../src/ui/onboardingTaskModel";

test("paused presentation clock has no onboarding commit while the current task is unchanged", () => {
  // Given
  const presentation = {
    ...createOnboardingPresentationState(),
    completedTaskIds: ["task-1"] as const,
  };

  // When
  const firstTick = nextOnboardingPresentationCommit({
    gameState: DEFAULT_GAME_STATE,
    presentation,
    nowMs: 1_000,
  });
  const secondTick = nextOnboardingPresentationCommit({
    gameState: DEFAULT_GAME_STATE,
    presentation,
    nowMs: 1_100,
  });

  // Then
  assert.equal(firstTick, null);
  assert.equal(secondTick, null);
});
