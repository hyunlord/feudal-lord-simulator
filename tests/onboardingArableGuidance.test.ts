import assert from "node:assert/strict";
import test from "node:test";

import { c25ZonedState } from "../scripts/c25Board";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { arableAdjacentOrigins } from "../src/ui/onboardingArableGuidance";
import { arableZoneBesideFootprint } from "../src/zones/zonePlacement";

// C1f 0-B: the farmstead guidance prefilter keeps exactly the origins the zone rule (Z-11) can accept.
test("Given a map with and without arable zones When the prefilter is built Then it equals the origins arableZoneBesideFootprint accepts", () => {
  for (const state of [DEFAULT_GAME_STATE, c25ZonedState()]) {
    const origins = arableAdjacentOrigins(state);
    for (let ty = 0; ty < state.height; ty += 1) for (let tx = 0; tx < state.width; tx += 1) {
      const accepted = arableZoneBesideFootprint(state, "farmstead", tx, ty) !== null;
      assert.equal(origins.has(ty * state.width + tx), accepted, `${tx},${ty}`);
    }
  }
  assert.equal(arableAdjacentOrigins(DEFAULT_GAME_STATE).size, 0, "a new game has no arable zone");
  assert.ok(arableAdjacentOrigins(c25ZonedState()).size > 0, "control: the zoned C25 board has arable origins");
});
