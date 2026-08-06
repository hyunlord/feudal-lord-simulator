import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { nextOnboardingPresentationCommit } from "../src/App";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { createOnboardingPresentationState } from "../src/ui/onboardingTaskModel";

const APP_SOURCE = new URL("../src/App.tsx", import.meta.url);

test("paused presentation clock has no onboarding commit while the current task is unchanged", () => {
  // Given
  const presentation = createOnboardingPresentationState();

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

test("presentation clock stops once the open goal is reached", async () => {
  // Given
  const source = await readFile(APP_SOURCE, "utf8");

  // Then
  assert.match(source, /onboardingPresentation\.openGoalReached/);
  assert.match(source, /window\.setInterval\(\(\) => setPresentationNowMs\(Date\.now\(\)\), 100\)/);
});
