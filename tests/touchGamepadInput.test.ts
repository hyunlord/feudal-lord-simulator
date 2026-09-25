import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { createIntentBus, INTENT_ORDER } from "../src/input/intentBus";
import type { InputIntent } from "../src/input/inputIntent";
import { createGamepadTranslator, DEAD_ZONE, type PadState } from "../src/input/gamepadTranslator";
import { createMouseKeyboardTranslator } from "../src/input/mouseKeyboardTranslator";
import { createTouchTranslator, LONG_PRESS_MS } from "../src/input/touchTranslator";
import { clampPan, worldToCanvas, type CameraState } from "../src/render/camera";
import { createCanvasIntentHandler } from "../src/render/canvasIntentHandler";
import { createCanvasMutableRefs } from "../src/render/canvasRuntimeRefs";
import { createZoneBrushContext } from "../src/render/canvasZoneBrushRuntime";
import { worldBounds } from "../src/render/interactions";
import { tileToScreen } from "../src/render/iso";
import type { PlacementTool } from "../src/render/renderer";
import type { ZoneBrushTool } from "../src/render/zoneBrushInteraction";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";

// TOUCH-1: the touch and gamepad translators run end to end (translator -> bus -> canvas handler -> game actions)
// and must produce what the mouse produces for the same operation (docs/design/input-intents.md IN-7, IN-8).

const RECT = { left: 0, top: 0, width: 1280, height: 800 };

function runtime(state: GameState, tool: PlacementTool | null, zoneTool: ZoneBrushTool | null = null) {
  const canvas = { getBoundingClientRect: () => RECT, title: "" } as unknown as HTMLCanvasElement;
  const camera: CameraState = { zoom: 1, panX: 640 - tileToScreen(44, 41).sx, panY: 400 - tileToScreen(44, 41).sy };
  const refs = createCanvasMutableRefs(camera);
  const stateRef = { current: state };
  const actions: GameAction[] = [];
  const intents: InputIntent[] = [];
  const dispatch = (action: GameAction) => { actions.push(action); stateRef.current = gameReducer(stateRef.current, action); };
  const world = () => worldBounds(state.width, state.height);
  const clampCamera = (next: CameraState) => clampPan(next, RECT, world());
  const zoneToolRef = { current: zoneTool };
  const zone = createZoneBrushContext({ toolRef: zoneToolRef, radiusRef: { current: undefined }, refs, stateRef, dispatch, clampCamera });
  const bus = createIntentBus();
  bus.subscribe(intent => { intents.push(intent); return undefined; }, -1);
  bus.subscribe(createCanvasIntentHandler({ canvas, refs, stateRef, selectedToolRef: { current: tool }, palisadeDraftRef: { current: null }, zone,
    dispatch, setSelection: () => undefined, setHoveredBuilding: () => undefined, onPalisadeDraftChange: undefined, clampCamera,
    viewport: () => RECT, world, markUserControlled: () => undefined }), INTENT_ORDER.world);
  const armed = () => ({ zone: zoneToolRef.current !== null, zonePolygon: false, palisade: false, road: tool === "road", tool: tool !== null || zoneToolRef.current !== null });
  const mouse = createMouseKeyboardTranslator({ bounds: () => RECT, camera: () => refs.cameraRef.current, world, armed,
    emit: (intent, context) => bus.emit(intent, context), setTimeout: () => 1, clearTimeout: () => undefined });
  const timers: (() => void)[] = [];
  let nowMs = 1000;
  const touch = createTouchTranslator({ bounds: () => RECT, camera: () => refs.cameraRef.current, armed, emit: intent => bus.emit(intent), mouse,
    now: () => nowMs, setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout: handle => { timers[handle - 1] = () => undefined; } });
  let pad: PadState = { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const gamepad = createGamepadTranslator({ bounds: () => RECT, camera: () => refs.cameraRef.current, armed, emit: intent => bus.emit(intent), mouse, gamepads: () => [pad] });
  const client = (tx: number, ty: number) => {
    const at = worldToCanvas({ x: tileToScreen(tx, ty).sx, y: tileToScreen(tx, ty).sy }, refs.cameraRef.current);
    return { clientX: at.x, clientY: at.y };
  };
  const setPad = (change: { readonly axes?: readonly number[]; readonly press?: readonly number[] }) => {
    pad = { ...pad, axes: change.axes ?? pad.axes,
      buttons: pad.buttons.map((_, index) => ({ pressed: change.press?.includes(index) === true, value: change.press?.includes(index) === true ? 1 : 0 })) };
  };
  return { mouse, touch, gamepad, actions, intents, stateRef, refs, client, setPad, zoneToolRef,
    fireTimers: () => { for (const timer of timers.splice(0)) timer(); }, advance: (ms: number) => { nowMs += ms; } };
}

test("Given the road tool When a road is dragged by one finger Then the actions equal the mouse drag's", () => {
  const byMouse = runtime(DEFAULT_GAME_STATE, "road"); const byTouch = runtime(DEFAULT_GAME_STATE, "road");
  const a = byMouse.client(43, 44); const b = byMouse.client(47, 44);
  byMouse.mouse.pointerDown({ button: 0, ...a }); byMouse.mouse.pointerMove(b); byMouse.mouse.pointerUp({ button: 0, ...b }); byMouse.mouse.click(b);
  byTouch.touch.start([a]); byTouch.touch.move([b]); byTouch.touch.end(0);
  assert.ok(byMouse.actions.length > 0);
  assert.deepEqual(byTouch.actions, byMouse.actions);
});

test("Given a building tool When the map is tapped Then the placement equals the mouse click's", () => {
  const byMouse = runtime(DEFAULT_GAME_STATE, "house"); const byTouch = runtime(DEFAULT_GAME_STATE, "house");
  const p = byMouse.client(48, 38);
  byMouse.mouse.pointerMove(p); byMouse.mouse.pointerDown({ button: 0, ...p }); byMouse.mouse.pointerUp({ button: 0, ...p }); byMouse.mouse.click(p);
  byTouch.touch.start([p]); byTouch.touch.end(0);
  assert.deepEqual(byTouch.actions, byMouse.actions);
});

test("Given the road tool When two fingers drag Then the camera pans and zooms and no road is placed, and a stroke in progress is dropped (gate 3)", () => {
  const run = runtime(DEFAULT_GAME_STATE, "road");
  const before = run.refs.cameraRef.current;
  run.touch.start([run.client(43, 44)]);
  run.touch.move([run.client(45, 44)]);
  run.touch.start([{ clientX: 600, clientY: 400 }, { clientX: 700, clientY: 400 }]);
  run.touch.move([{ clientX: 560, clientY: 380 }, { clientX: 660, clientY: 380 }]);
  run.touch.move([{ clientX: 540, clientY: 380 }, { clientX: 700, clientY: 380 }]);
  run.touch.end(1); run.touch.end(0);
  assert.deepEqual(run.actions, []);
  assert.ok(run.intents.some(intent => intent.kind === "cancel" && intent.world !== undefined), "the road stroke was cancelled");
  const pans = run.intents.filter(intent => intent.kind === "pan");
  assert.equal(pans.reduce((sum, intent) => sum + (intent.kind === "pan" ? intent.dx : 0), 0), -30);
  assert.ok(run.intents.some(intent => intent.kind === "zoom" && Math.abs(intent.factor - 1.6) < 1e-9 && intent.anchor.x === 620));
  assert.notDeepEqual(run.refs.cameraRef.current, before);
});

test("Given no tool When a finger is held still Then it inspects there and does not select; a two-finger tap cancels aimed at the map", () => {
  const run = runtime(DEFAULT_GAME_STATE, null);
  run.touch.start([{ clientX: 640, clientY: 400 }]);
  run.fireTimers();
  run.touch.end(0);
  assert.ok(run.intents.some(intent => intent.kind === "inspect"));
  assert.equal(run.intents.some(intent => intent.kind === "select"), false);
  assert.ok(LONG_PRESS_MS === 400);
  run.touch.start([{ clientX: 600, clientY: 400 }, { clientX: 680, clientY: 400 }]); run.advance(120); run.touch.end(0);
  const cancel = run.intents.filter(intent => intent.kind === "cancel").at(-1);
  assert.ok(cancel !== undefined && cancel.kind === "cancel" && cancel.world !== undefined, "no tool: aimed cancel");
  const armed = runtime(DEFAULT_GAME_STATE, "house");
  armed.touch.start([{ clientX: 600, clientY: 400 }, { clientX: 680, clientY: 400 }]); armed.advance(120); armed.touch.end(0);
  const global = armed.intents.filter(intent => intent.kind === "cancel").at(-1);
  assert.ok(global !== undefined && global.kind === "cancel" && global.world === undefined, "tool armed: global cancel");
});

test("Given a gamepad When the left stick moves the cursor and A is pressed with a building tool Then it places where the cursor is, like a click there", () => {
  const byPad = runtime(DEFAULT_GAME_STATE, "house"); const byMouse = runtime(DEFAULT_GAME_STATE, "house");
  byPad.setPad({ axes: [DEAD_ZONE / 2, 0, 0, 0] });
  byPad.gamepad.frame(0, 16);
  byPad.gamepad.recentre();
  const start = byPad.gamepad.cursor();
  byPad.gamepad.frame(16, 16);
  assert.deepEqual(byPad.gamepad.cursor(), start, "inside the dead zone the cursor stays");
  byPad.setPad({ axes: [1, 0, 0, 0] });
  for (let frame = 0; frame < 30; frame += 1) byPad.gamepad.frame(32 + frame * 16, 16);
  byPad.setPad({ axes: [0, 0, 0, 0] }); byPad.gamepad.frame(600, 16);
  const cursor = byPad.gamepad.cursor();
  assert.ok(cursor !== null && start !== null && cursor.x > start.x && cursor.y === start.y);
  byPad.setPad({ press: [0] }); byPad.gamepad.frame(620, 16);
  byPad.setPad({}); byPad.gamepad.frame(640, 16);
  const at = worldToCanvas(cursor as { x: number; y: number }, byMouse.refs.cameraRef.current);
  byMouse.mouse.pointerMove({ clientX: at.x, clientY: at.y }); byMouse.mouse.pointerDown({ button: 0, clientX: at.x, clientY: at.y });
  byMouse.mouse.pointerUp({ button: 0, clientX: at.x, clientY: at.y }); byMouse.mouse.click({ clientX: at.x, clientY: at.y });
  assert.ok(byMouse.actions.length > 0);
  assert.deepEqual(byPad.actions, byMouse.actions);
});

test("Given a gamepad When X arms a zone brush and A is held while the stick moves Then it paints a stroke; B with no tool cancels at the cursor", () => {
  const run = runtime(DEFAULT_GAME_STATE, null);
  run.setPad({ press: [2] }); run.gamepad.frame(0, 16); run.setPad({}); run.gamepad.frame(16, 16);
  assert.ok(run.intents.some(intent => intent.kind === "toolSelect" && intent.toolId === "zone:burgage"));
  run.zoneToolRef.current = { target: "pasture", radius: 1, polygon: false };
  run.gamepad.recentre();
  run.setPad({ press: [0] }); run.gamepad.frame(32, 16);
  run.setPad({ press: [0], axes: [1, 0, 0, 0] }); for (let frame = 0; frame < 10; frame += 1) run.gamepad.frame(48 + frame * 16, 16);
  run.setPad({}); run.gamepad.frame(300, 16);
  const kinds = run.intents.map(intent => intent.kind);
  assert.ok(kinds.includes("strokeBegin") && kinds.includes("strokeMove") && kinds.includes("strokeEnd"));
  assert.ok(run.actions.some(action => action.type === "zone_paint"));
  const plain = runtime(DEFAULT_GAME_STATE, null);
  plain.setPad({ press: [1] }); plain.gamepad.frame(0, 16);
  const cancel = plain.intents.find(intent => intent.kind === "cancel");
  assert.ok(cancel !== undefined && cancel.kind === "cancel" && cancel.world !== undefined);
});

test("Given the zone brush or a building tool When two fingers drag Then the camera moves and nothing is painted or placed (gate 3)", () => {
  for (const [tool, zoneTool] of [[null, { target: "pasture", radius: 2, polygon: false }], ["house", null]] as const) {
    const run = runtime(DEFAULT_GAME_STATE, tool, zoneTool as ZoneBrushTool | null);
    const before = run.refs.cameraRef.current;
    run.touch.start([{ clientX: 600, clientY: 400 }, { clientX: 680, clientY: 400 }]);
    run.touch.move([{ clientX: 560, clientY: 360 }, { clientX: 640, clientY: 360 }]);
    run.touch.end(0);
    assert.deepEqual(run.actions, [], `${tool ?? "zone"}: no action`);
    assert.equal(run.refs.cameraRef.current.panX, before.panX - 40);
    assert.equal(run.refs.cameraRef.current.panY, before.panY - 40);
  }
});
