import assert from "node:assert/strict";
import { test } from "node:test";
import type { GameState } from "../src/engine/engine.types";
import type { PlacementTool } from "../src/render/renderer";
import { DEFAULT_ZONE_BRUSH_RADIUS } from "../src/render/zoneBrushInteraction";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import {
  currentStepIndex, stepAction, tutorialAccess, TUTORIAL_STEP_IDS,
  type ControlLayer, type TutorialStepId, type TutorialZoneTarget,
} from "../src/ui/tutorial/tutorialModel";

// UX-1 gate 1 (logic half): the 13-step first-session script plays on a new game by following the card button's
// action only (arm the tool, then place at the suggested spot), through the game reducer. The browser replay
// (scripts/tutorialReplay.mjs) presses the real buttons.

type Played = { readonly state: GameState; readonly acks: ReadonlySet<TutorialStepId>; readonly log: readonly string[] };

export function playTutorial(start: GameState, maxPresses = 60): Played {
  let state = start; const acks = new Set<TutorialStepId>(); const log: string[] = [];
  let armed: { tool: PlacementTool | null; zone: TutorialZoneTarget | null; layer: ControlLayer } = { tool: null, zone: null, layer: "direct" };
  for (let press = 0; press < maxPresses; press += 1) {
    const index = currentStepIndex(state, acks);
    if (index >= TUTORIAL_STEP_IDS.length) break;
    const id = TUTORIAL_STEP_IDS[index]!;
    const action = stepAction(state, id, armed, DEFAULT_ZONE_BRUSH_RADIUS);
    assert.ok(action !== null, `step ${id}: no action (armed ${JSON.stringify(armed)})`);
    log.push(`${id}:${action.kind}`);
    switch (action.kind) {
      case "ack": acks.add(action.step); break;
      case "layer": armed = { ...armed, layer: action.layer }; acks.add(action.step); break;
      case "arm": armed = { tool: action.tool, zone: null, layer: "direct" }; break;
      case "armZone": armed = { tool: null, zone: action.target, layer: action.target === "burgage" ? "zone" : "direct" }; break;
      case "place": {
        const next = action.tool === "road"
          ? gameReducer(state, { type: "place_road_line", start: action.tile, destination: action.tile })
          : gameReducer(state, { type: "place_building", kind: action.tool, tx: action.tile.tx, ty: action.tile.ty });
        assert.notEqual(next, state, `step ${id}: placing ${action.tool} at ${action.tile.tx},${action.tile.ty} changed nothing`);
        state = next; break;
      }
      case "paintZone": {
        const next = gameReducer(state, { type: "zone_paint", kind: action.target === "erase" ? "burgage" : action.target, stroke: action.stroke });
        assert.notEqual(next, state, `step ${id}: painting ${action.target} changed nothing`);
        state = next; break;
      }
    }
  }
  return { state, acks, log };
}

test("Given a new game When only the card buttons are followed Then all 13 tutorial steps complete", () => {
  const played = playTutorial(DEFAULT_GAME_STATE);
  assert.equal(currentStepIndex(played.state, played.acks), TUTORIAL_STEP_IDS.length, played.log.join(" "));
  assert.equal(TUTORIAL_STEP_IDS.length, 13);
});

test("Given each step When access is read Then only the script's categories and tools are open (gate 2)", () => {
  const at = (id: TutorialStepId) => tutorialAccess(true, TUTORIAL_STEP_IDS.indexOf(id));
  assert.deepEqual(at("greet").categories, { living: true, paths: true, trade: false, storage: false, public: false, defense: false });
  assert.ok(at("well").tools("well") && at("well").tools("house") && at("well").tools("road") && !at("well").tools("farmstead"));
  assert.ok(at("arable").categories.trade && at("arable").arableCard && !at("arable").tools("farmstead"));
  assert.ok(at("food_chain").tools("farmstead") && at("food_chain").tools("mill") && !at("food_chain").tools("sawmill"));
  assert.ok(!at("food_chain").categories.storage && at("granary").categories.storage && at("granary").tools("granary") && !at("granary").tools("storehouse"));
  assert.ok(!at("granary").layers.zone && at("zone_unlock").layers.zone);
  assert.ok(at("burgage").zoneTargets("burgage") && !at("burgage").zoneTargets("pasture"));
  for (const id of TUTORIAL_STEP_IDS) assert.ok(!at(id).categories.public && !at(id).categories.defense && !at(id).layers.direction, id);
  const done = tutorialAccess(true, TUTORIAL_STEP_IDS.length);
  const off = tutorialAccess(false, 0);
  for (const access of [done, off]) {
    assert.ok(Object.values(access.categories).every(Boolean));
    assert.ok(access.tools("sawmill") && access.tools("market") && access.zoneTargets("pasture") && access.layers.zone);
    assert.equal(access.layers.direction, false);
  }
});
