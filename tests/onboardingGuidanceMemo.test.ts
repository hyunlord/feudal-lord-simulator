import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { onboardingWorldGuidanceMemoStats, onboardingWorldGuidanceTargets } from "../src/ui/onboardingWorldGuidance";

test("Given unchanged guidance inputs When targets are asked again Then the memo returns the same targets without recomputing", () => {
  // Given
  const first = onboardingWorldGuidanceTargets(DEFAULT_GAME_STATE);
  const before = onboardingWorldGuidanceMemoStats();

  // When: within one guidance sample (60 ticks), only per-tick fields change (tick, walkers, route cache, new arrays
  // of the same buildings and sites and houses).
  const again = onboardingWorldGuidanceTargets({ ...DEFAULT_GAME_STATE, tick: 59, walkers: [], pathCache: {},
    buildings: DEFAULT_GAME_STATE.buildings.map(building => ({ ...building })), constructionSites: [...DEFAULT_GAME_STATE.constructionSites],
    houses: [...DEFAULT_GAME_STATE.houses] });

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

test("Given the guidance memo When the sample changes or a building is placed Then it recomputes at once (C1f 0-B)", () => {
  // Given
  onboardingWorldGuidanceTargets(DEFAULT_GAME_STATE);
  const before = onboardingWorldGuidanceMemoStats();

  // When: the next 60-tick sample, then the same sample with one more building
  onboardingWorldGuidanceTargets({ ...DEFAULT_GAME_STATE, tick: 60 });
  const moved = { ...DEFAULT_GAME_STATE, tick: 60, buildings: [...DEFAULT_GAME_STATE.buildings, { ...DEFAULT_GAME_STATE.buildings[0]!, id: "house-test", tx: 3, ty: 3 }] };
  onboardingWorldGuidanceTargets(moved);

  // Then
  assert.equal(onboardingWorldGuidanceMemoStats().misses, before.misses + 2);
});
