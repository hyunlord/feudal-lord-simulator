import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { onboardingWorldGuidanceMemoStats, onboardingWorldGuidanceTargets } from "../src/ui/onboardingWorldGuidance";

test("Given unchanged guidance inputs When targets are asked again Then the memo returns the same targets without recomputing", () => {
  // Given
  const first = onboardingWorldGuidanceTargets(DEFAULT_GAME_STATE);
  const before = onboardingWorldGuidanceMemoStats();

  // When: only fields no guidance rule reads change (tick, walkers, route cache).
  const again = onboardingWorldGuidanceTargets({ ...DEFAULT_GAME_STATE, tick: 99, walkers: [], pathCache: {} });

  // Then
  assert.equal(again, first);
  assert.equal(onboardingWorldGuidanceMemoStats().hits, before.hits + 1);
});

test("Given a changed guidance input When targets are asked Then they are recomputed and match an uncached computation", () => {
  // Given
  onboardingWorldGuidanceTargets(DEFAULT_GAME_STATE);
  const before = onboardingWorldGuidanceMemoStats();
  const withRoad = { ...DEFAULT_GAME_STATE, tiles: DEFAULT_GAME_STATE.tiles.map(tile => tile.tx === 45 && tile.ty === 43 ? { ...tile, hasRoad: true } : tile) };

  // When
  const targets = onboardingWorldGuidanceTargets(withRoad);

  // Then
  assert.equal(onboardingWorldGuidanceMemoStats().misses, before.misses + 1);
  onboardingWorldGuidanceTargets({ ...DEFAULT_GAME_STATE, era: DEFAULT_GAME_STATE.era });
  assert.deepEqual(onboardingWorldGuidanceTargets({ ...withRoad }), targets);
});
