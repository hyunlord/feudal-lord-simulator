import assert from "node:assert/strict";
import test from "node:test";
import type { GameState } from "../src/engine/engine.types";
import type { CanvasMutableRefs } from "../src/render/canvasRuntimeRefs";
import { createZoneBrushContext, zoneKeyDown } from "../src/render/canvasZoneBrushRuntime";
import { ZONE_BRUSH_COPY } from "../src/render/zoneBrushCopy.ko";
import { gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";
import { zonesOf } from "../src/zones/zoneEdits";
import { seedGroundState } from "../scripts/boundaryFixtureStates";

function brushContext(state: GameState) {
  const stateRef = { current: state };
  const actions: GameAction[] = [];
  const refs = { feedbackRef: { current: null }, cameraRef: { current: { panX: 0, panY: 0, zoom: 1 } },
    dragRef: { current: { mode: "none" } }, spacePressed: { current: false }, suppressClick: { current: false } } as unknown as CanvasMutableRefs;
  const context = createZoneBrushContext({ toolRef: { current: { target: "pasture", radius: 2, polygon: false } }, radiusRef: { current: undefined },
    refs, stateRef, dispatch: action => { actions.push(action); stateRef.current = gameReducer(stateRef.current, action); }, clampCamera: camera => camera });
  const key = (code: string) => zoneKeyDown(context, { code, preventDefault: () => undefined, stopImmediatePropagation: () => undefined } as unknown as KeyboardEvent);
  return { context, stateRef, actions, refs, key };
}

test("Z undoes the last zone stroke through zone_undo_stroke, and says so when there is nothing to undo", () => {
  const base = seedGroundState(2);
  const painted = gameReducer(base, { type: "zone_paint", kind: "pasture", stroke: { tool: "brush", points: [{ x: 30.5, y: 30.5 }], radius: 2 } });
  assert.ok(zonesOf(painted).length > zonesOf(base).length);
  const brush = brushContext(painted);
  assert.equal(brush.key("KeyZ"), true);
  assert.deepEqual(brush.actions, [{ type: "zone_undo_stroke" }]);
  assert.deepEqual(zonesOf(brush.stateRef.current), zonesOf(base));
  assert.equal((brush.refs.feedbackRef.current as { message: string } | null)?.message, ZONE_BRUSH_COPY.undone);
  assert.equal(brush.key("KeyZ"), true);
  assert.equal(brush.actions.length, 1, "an empty undo stack dispatches nothing");
  assert.equal((brush.refs.feedbackRef.current as { message: string } | null)?.message, ZONE_BRUSH_COPY.nothingToUndo);
});

test("Z during a stroke drops the stroke like Esc and undoes nothing", () => {
  const painted = gameReducer(seedGroundState(2), { type: "zone_paint", kind: "pasture", stroke: { tool: "brush", points: [{ x: 30.5, y: 30.5 }], radius: 2 } });
  const brush = brushContext(painted);
  brush.context.zone.gestureRef.current = { mode: "brush", points: [{ x: 34.5, y: 30.5 }] } as never;
  assert.equal(brush.key("KeyZ"), true);
  assert.equal(brush.context.zone.gestureRef.current, null);
  assert.equal(brush.actions.some(action => action.type === "zone_undo_stroke"), false);
});
