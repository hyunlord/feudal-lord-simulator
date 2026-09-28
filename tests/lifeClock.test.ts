import assert from "node:assert/strict";
import { test } from "node:test";

import { createLifeClock, MAX_STEP_MS } from "../src/render/lifeClock";

// INSTALL-23b: the village life's clock holds while the game is paused and runs at the wall's pace otherwise.
test("Given a life clock When frames pass running, then paused, then running Then it advances only while running", () => {
  // Given
  const clock = createLifeClock();

  // When / Then
  assert.equal(clock(1_000, true), 0);
  assert.equal(clock(1_016, true), 16);
  assert.equal(clock(1_032, true), 32);
  assert.equal(clock(1_500, false), 32);
  assert.equal(clock(3_000, false), 32);
  assert.equal(clock(3_016, true), 48);
});

test("Given a long gap between frames When the clock advances Then one frame moves it at most MAX_STEP_MS", () => {
  const clock = createLifeClock();
  clock(0, true);
  assert.equal(clock(10_000, true), MAX_STEP_MS);
  assert.equal(clock(9_000, true), MAX_STEP_MS);
});
