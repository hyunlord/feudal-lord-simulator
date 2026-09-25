import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { createIntentBus, INTENT_ORDER } from "../src/input/intentBus";
import type { InputIntent } from "../src/input/inputIntent";
import { createMouseKeyboardTranslator, type ArmedTools } from "../src/input/mouseKeyboardTranslator";
import { createZoneTouchTranslator } from "../src/input/zoneTouchTranslator";
import { clampPan, type CameraState } from "../src/render/camera";
import { createCanvasIntentHandler } from "../src/render/canvasIntentHandler";
import { createCanvasMutableRefs } from "../src/render/canvasRuntimeRefs";
import { createZoneBrushContext } from "../src/render/canvasZoneBrushRuntime";
import { resolveBuildingPlacementAttempt, resolveRoadPlacementAttempt, worldBounds } from "../src/render/interactions";
import { tileToScreen } from "../src/render/iso";
import type { PlacementTool } from "../src/render/renderer";
import type { ZoneBrushTool } from "../src/render/zoneBrushInteraction";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";
import { getTile } from "../src/world/grid";

// B9 input intents: the mouse / keyboard translation table (docs/design/input-intents.md) and the same player
// operations run end to end (translator -> bus -> canvas handler -> game actions) against the pure resolvers the
// old DOM callbacks called.

const RECT = { left: 0, top: 0, width: 1280, height: 800 };
const NO_TOOLS: ArmedTools = { zone: false, zonePolygon: false, palisade: false, road: false };

function translatorWith(armed: Partial<ArmedTools> = {}, accept: (intent: InputIntent) => boolean = () => true) {
  const intents: InputIntent[] = [];
  let camera: CameraState = { zoom: 1, panX: 0, panY: 0 };
  const translator = createMouseKeyboardTranslator({
    bounds: () => RECT, camera: () => camera, world: () => ({ minX: -100_000, minY: -100_000, maxX: 100_000, maxY: 100_000 }),
    armed: () => ({ ...NO_TOOLS, ...armed }),
    emit: intent => {
      intents.push(intent);
      if (intent.kind === "pan") camera = { ...camera, panX: camera.panX + intent.dx, panY: camera.panY + intent.dy };
      return accept(intent);
    },
    setTimeout: () => 1, clearTimeout: () => undefined,
  });
  const kinds = () => intents.filter(intent => intent.kind !== "point").map(intent => intent.kind);
  return { translator, intents, kinds, camera: () => camera };
}

const at = (x: number, y: number, button = 0, extra: { shiftKey?: boolean; detail?: number } = {}) => ({ button, clientX: x, clientY: y, ...extra });

test("Given the road tool When the left button drags Then strokeBegin / strokeMove / strokeEnd, and the click that follows is swallowed", () => {
  const { translator, kinds } = translatorWith({ road: true });
  translator.pointerDown(at(100, 100));
  translator.pointerMove(at(130, 100));
  translator.pointerUp(at(130, 100));
  translator.click(at(130, 100));
  assert.deepEqual(kinds(), ["strokeBegin", "strokeMove", "strokeEnd"]);
});

test("Given the road tool When the button is pressed and released in place Then the click is a select (single tile)", () => {
  const { translator, kinds } = translatorWith({ road: true });
  translator.pointerDown(at(100, 100)); translator.pointerMove(at(102, 101)); translator.pointerUp(at(102, 101)); translator.click(at(102, 101));
  assert.deepEqual(kinds(), ["strokeBegin", "strokeMove", "strokeEnd", "select"]);
});

test("Given no drawing tool When the left button drags Then pan deltas follow the pointer from the camera at the first move, and the click is swallowed", () => {
  const { translator, intents, kinds, camera } = translatorWith();
  translator.pointerDown(at(100, 100));
  translator.pointerMove(at(102, 100));
  translator.pointerMove(at(150, 120));
  translator.pointerMove(at(160, 140));
  translator.pointerUp(at(160, 140));
  translator.click(at(160, 140));
  assert.deepEqual(kinds(), ["pan", "pan"], "nothing before the 4 px threshold, no select after");
  assert.deepEqual(camera(), { zoom: 1, panX: 60, panY: 40 });
  assert.ok(intents.every(intent => intent.kind !== "strokeBegin"));
});

test("Given Space When it is held with a road tool Then the left drag pans; a Space tap alone toggles pause, a Space drag does not", () => {
  const held = translatorWith({ road: true });
  held.translator.keyDown({ code: "Space", key: " ", target: null });
  held.translator.pointerDown(at(100, 100)); held.translator.pointerMove(at(140, 100)); held.translator.pointerUp(at(140, 100));
  held.translator.keyUp({ code: "Space", key: " ", target: null });
  assert.deepEqual(held.kinds(), ["pan"]);
  const tap = translatorWith();
  tap.translator.keyDown({ code: "Space", key: " ", target: null });
  tap.translator.keyUp({ code: "Space", key: " ", target: null });
  assert.deepEqual(tap.kinds(), ["pauseToggle"]);
});

test("Given the zone brush When it is pressed, shift-pressed and double-clicked in polygon mode Then stroke, polygon vertex and confirm", () => {
  const brush = translatorWith({ zone: true });
  brush.translator.pointerDown(at(100, 100));
  brush.translator.pointerMove(at(140, 100));
  brush.translator.pointerUp(at(140, 100));
  brush.translator.pointerDown(at(200, 100, 0, { shiftKey: true }));
  brush.translator.pointerUp(at(200, 100));
  assert.deepEqual(brush.intents.filter(intent => intent.kind === "strokeBegin").map(intent => intent.kind === "strokeBegin" && intent.polygon), [false, true]);
  assert.deepEqual(brush.kinds(), ["strokeBegin", "strokeMove", "strokeEnd", "strokeBegin"]);
  const polygon = translatorWith({ zone: true, zonePolygon: true });
  polygon.translator.pointerDown(at(100, 100, 0, { detail: 2 }));
  assert.deepEqual(polygon.kinds(), ["confirm"]);
});

test("Given a palisade draft When the handler declines the press Then the drag pans instead", () => {
  const { translator, kinds } = translatorWith({ palisade: true }, intent => intent.kind !== "strokeBegin");
  translator.pointerDown(at(100, 100)); translator.pointerMove(at(140, 100)); translator.pointerUp(at(140, 100));
  assert.deepEqual(kinds(), ["strokeBegin", "pan"]);
});

test("Given a road stroke When the right button cancels it Then its right release is ignored and the left release places nothing", () => {
  const { translator, intents, kinds } = translatorWith({ road: true });
  translator.pointerDown(at(100, 100)); translator.pointerMove(at(140, 100));
  assert.equal(translator.pointerDown(at(140, 100, 2)).preventDefault, false);
  assert.equal(translator.contextMenu(at(140, 100)).preventDefault, true);
  translator.pointerUp(at(140, 100, 2)); translator.pointerUp(at(140, 100)); translator.click(at(140, 100));
  assert.deepEqual(kinds(), ["strokeBegin", "strokeMove", "cancel"]);
  assert.ok(intents.some(intent => intent.kind === "cancel" && intent.world !== undefined));
});

test("Given a stroke When the button is released off the map Then strokeEnd says outside", () => {
  const { translator, intents } = translatorWith({ road: true });
  translator.pointerDown(at(100, 100)); translator.pointerMove(at(140, 100)); translator.pointerUp(at(1400, 100));
  assert.deepEqual(intents.filter(intent => intent.kind === "strokeEnd").map(intent => intent.kind === "strokeEnd" && intent.outside), [true]);
});

test("Given the wheel and the keys When they are used Then zoom, cancel, undo, brush size, views, confirm, tool step and keyboard zoom", () => {
  const { translator, intents } = translatorWith();
  translator.wheel({ clientX: 10, clientY: 20, deltaY: 100 });
  translator.wheel({ clientX: 10, clientY: 20, deltaY: -100 });
  for (const code of ["Escape", "KeyZ", "BracketRight", "BracketLeft", "KeyO", "Digit3", "Enter", "KeyQ", "KeyE", "Equal", "Minus"]) translator.keyDown({ code, key: "", target: null });
  translator.keyDown({ code: "KeyO", key: "o", repeat: true, target: null });
  assert.deepEqual(intents.map(intent => JSON.stringify(intent)), [
    { kind: "zoom", factor: 0.9, anchor: { x: 10, y: 20 } }, { kind: "zoom", factor: 1.1, anchor: { x: 10, y: 20 } },
    { kind: "cancel" }, { kind: "undo" }, { kind: "brushSize", step: 1 }, { kind: "brushSize", step: -1 }, { kind: "problemView" },
    { kind: "overlayToggle", slot: 3 }, { kind: "confirm" }, { kind: "toolStep", step: -1 }, { kind: "toolStep", step: 1 },
    { kind: "zoom", factor: 1.1, anchor: { x: 640, y: 400 } }, { kind: "zoom", factor: 0.9, anchor: { x: 640, y: 400 } },
  ].map(intent => JSON.stringify(intent)));
});

test("Given the intent bus When a handler consumes an intent Then later handlers do not see it, in order regardless of subscription order", () => {
  const bus = createIntentBus();
  const seen: string[] = [];
  bus.subscribe(() => { seen.push("app"); return "handled"; }, INTENT_ORDER.app);
  bus.subscribe(intent => { seen.push("world"); return intent.kind === "cancel" ? "consumed" : undefined; }, INTENT_ORDER.world);
  assert.equal(bus.emit({ kind: "cancel" }), true);
  assert.equal(bus.emit({ kind: "undo" }), true);
  assert.deepEqual(seen, ["world", "world", "app"]);
});

// End to end: translator -> bus -> canvas handler, with a real state.
function runtimeFor(state: GameState, tool: PlacementTool | null, zoneTool: ZoneBrushTool | null = null) {
  const canvas = { getBoundingClientRect: () => RECT, title: "" } as unknown as HTMLCanvasElement;
  const camera: CameraState = { zoom: 1, panX: 640 - tileToScreen(44, 41).sx, panY: 400 - tileToScreen(44, 41).sy };
  const refs = createCanvasMutableRefs(camera);
  const stateRef = { current: state };
  const actions: GameAction[] = [];
  const dispatch = (action: GameAction) => { actions.push(action); stateRef.current = gameReducer(stateRef.current, action); };
  const world = () => worldBounds(state.width, state.height);
  const clampCamera = (next: CameraState) => clampPan(next, RECT, world());
  const zoneToolRef = { current: zoneTool };
  const zone = createZoneBrushContext({ toolRef: zoneToolRef, radiusRef: { current: undefined }, refs, stateRef, dispatch, clampCamera });
  const bus = createIntentBus();
  let selection: unknown = null;
  bus.subscribe(createCanvasIntentHandler({ canvas, refs, stateRef, selectedToolRef: { current: tool }, palisadeDraftRef: { current: null }, zone,
    dispatch, setSelection: value => { selection = typeof value === "function" ? value(selection as never) : value; }, setHoveredBuilding: () => undefined,
    onPalisadeDraftChange: undefined, clampCamera, viewport: () => RECT, world, markUserControlled: () => undefined }), INTENT_ORDER.world);
  const translator = createMouseKeyboardTranslator({ bounds: () => RECT, camera: () => refs.cameraRef.current, world,
    armed: () => ({ zone: zoneToolRef.current !== null, zonePolygon: false, palisade: false, road: tool === "road" }),
    emit: (intent, context) => bus.emit(intent, context), setTimeout: () => 1, clearTimeout: () => undefined });
  const client = (tx: number, ty: number) => {
    const screen = tileToScreen(tx, ty);
    return { clientX: screen.sx * refs.cameraRef.current.zoom + refs.cameraRef.current.panX, clientY: screen.sy * refs.cameraRef.current.zoom + refs.cameraRef.current.panY };
  };
  return { translator, actions, stateRef, refs, client, selection: () => selection, touch: createZoneTouchTranslator({ bounds: () => RECT, camera: () => refs.cameraRef.current,
    armed: () => ({ zone: zoneToolRef.current !== null, zonePolygon: false, palisade: false, road: false }), emit: intent => bus.emit(intent) }) };
}

test("Given the road tool When a road is dragged through the intents Then the same place_road_line action as the old drag resolver", () => {
  const run = runtimeFor(DEFAULT_GAME_STATE, "road");
  const from = run.client(43, 44); const to = run.client(47, 44);
  run.translator.pointerDown({ button: 0, ...from });
  run.translator.pointerMove({ ...to });
  run.translator.pointerUp({ button: 0, ...to });
  run.translator.click({ ...to });
  const expected = resolveRoadPlacementAttempt({ state: DEFAULT_GAME_STATE, start: { tx: 43, ty: 44 }, destination: { tx: 47, ty: 44 }, nowMs: 0 }).action;
  assert.deepEqual(run.actions, [expected]);
});

test("Given the road tool When one tile is clicked Then it toggles that tile, as the old click resolver did", () => {
  const run = runtimeFor(DEFAULT_GAME_STATE, "road");
  const point = run.client(44, 41);
  run.translator.pointerDown({ button: 0, ...point }); run.translator.pointerUp({ button: 0, ...point }); run.translator.click(point);
  assert.equal(getTile(run.stateRef.current, { tx: 44, ty: 41 })?.hasRoad, !getTile(DEFAULT_GAME_STATE, { tx: 44, ty: 41 })?.hasRoad);
  assert.equal(run.actions.length, 1);
});

test("Given a building tool When the map is clicked Then the placement is the old resolver's", () => {
  const run = runtimeFor(DEFAULT_GAME_STATE, "house");
  const point = run.client(50, 50);
  run.translator.pointerMove(point);
  run.translator.pointerDown({ button: 0, ...point }); run.translator.pointerUp({ button: 0, ...point }); run.translator.click(point);
  const expected = resolveBuildingPlacementAttempt({ state: DEFAULT_GAME_STATE, tool: "house", tile: run.refs.hoverRef.current ?? { tx: 50, ty: 50 }, nowMs: 0 }).action;
  assert.deepEqual(run.actions, expected === null ? [] : [expected]);
});

test("Given the zone brush When a stroke is painted by mouse and by one finger, then Z Then zone_paint twice and zone_undo_stroke", () => {
  const run = runtimeFor(DEFAULT_GAME_STATE, null, { target: "pasture", radius: 2, polygon: false });
  const a = run.client(20, 60); const b = run.client(24, 60);
  run.translator.pointerDown({ button: 0, ...a }); run.translator.pointerMove(b); run.translator.pointerUp({ button: 0, ...b });
  run.touch.start([a]); run.touch.move([b]); run.touch.end(0);
  run.translator.keyDown({ code: "KeyZ", key: "z", target: null });
  assert.deepEqual(run.actions.map(action => action.type), ["zone_paint", "zone_paint", "zone_undo_stroke"]);
});

test("Given no tool When the map is dragged and zoomed Then the camera moves and nothing is dispatched or selected", () => {
  const run = runtimeFor(DEFAULT_GAME_STATE, null);
  const before = run.refs.cameraRef.current;
  run.translator.pointerDown({ button: 0, clientX: 600, clientY: 400 }); run.translator.pointerMove({ clientX: 650, clientY: 430 });
  run.translator.pointerUp({ button: 0, clientX: 650, clientY: 430 }); run.translator.click({ clientX: 650, clientY: 430 });
  run.translator.wheel({ clientX: 640, clientY: 400, deltaY: -1 });
  assert.notDeepEqual(run.refs.cameraRef.current, before);
  assert.equal(run.refs.cameraRef.current.zoom > before.zoom, true);
  assert.deepEqual(run.actions, []);
  assert.equal(run.selection(), null);
});
