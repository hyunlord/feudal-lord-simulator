/**
 * UX-0b (cold start audit v2): a new goal game played by the tutorial's card buttons only, at the pace of a person who
 * reads each card. Shared by the pace survival test (FIX-4 gate ①) and the plot settlement test (gate ②).
 */
import type { GameState } from "../../src/engine/engine.types";
import { advanceTick } from "../../src/engine/tick";
import type { PlacementTool } from "../../src/render/renderer";
import { DEFAULT_ZONE_BRUSH_RADIUS } from "../../src/render/zoneBrushInteraction";
import { DEFAULT_GAME_STATE, gameReducer } from "../../src/state/gameStore";
import {
  currentStepIndex, stepAction, TUTORIAL_STEP_IDS, type ControlLayer, type TutorialStepId, type TutorialZoneTarget,
} from "../../src/ui/tutorial/tutorialModel";

/** Card presses at the base schedule (ticks); each lands at its tick times the pace. */
export const BASE_PRESSES = [0, 100, 160, 240, 300, 360, 440, 500, 600, 700, 780, 860, 920, 1000, 1060, 1200, 1400, 1500, 1600, 1700, 1800, 1900];

/** ARCH-1: `start` is a new game's opening (another land's); the default is the riverside town's. */
export function playAtPace(pace: number, endTick: number, start: GameState = DEFAULT_GAME_STATE): { readonly state: GameState; readonly doneAt: number | null } {
  let state: GameState = start;
  const acks = new Set<TutorialStepId>();
  let armed: { tool: PlacementTool | null; zone: TutorialZoneTarget | null; layer: ControlLayer } = { tool: null, zone: null, layer: "direct" };
  const presses = [...BASE_PRESSES.map(tick => Math.round(tick * pace)), ...Array.from({ length: 20 }, (_, index) => Math.round((2000 + index * 100) * pace))];
  let doneAt: number | null = null;
  let next = 0;
  while (state.tick < endTick) {
    while (next < presses.length && presses[next]! <= state.tick) {
      next += 1;
      const index = currentStepIndex(state, acks);
      if (index >= TUTORIAL_STEP_IDS.length) { doneAt ??= state.tick; continue; }
      const id = TUTORIAL_STEP_IDS[index]!;
      const action = stepAction(state, id, armed, DEFAULT_ZONE_BRUSH_RADIUS);
      if (action === null) continue;
      switch (action.kind) {
        case "ack": acks.add(action.step); break;
        case "layer": armed = { ...armed, layer: action.layer }; acks.add(action.step); break;
        case "arm": armed = { tool: action.tool, zone: null, layer: "direct" }; break;
        case "armZone": armed = { tool: null, zone: action.target, layer: action.target === "burgage" ? "zone" : "direct" }; break;
        case "place":
          state = action.tool === "road"
            ? gameReducer(state, { type: "place_road_line", start: action.tile, destination: action.tile })
            : gameReducer(state, { type: "place_building", kind: action.tool, tx: action.tile.tx, ty: action.tile.ty });
          break;
        case "paintZone":
          state = gameReducer(state, { type: "zone_paint", kind: action.target === "erase" ? "burgage" : action.target, stroke: action.stroke });
          break;
      }
    }
    if (doneAt === null && currentStepIndex(state, acks) >= TUTORIAL_STEP_IDS.length) doneAt = state.tick;
    state = advanceTick(state);
  }
  return { state, doneAt };
}

