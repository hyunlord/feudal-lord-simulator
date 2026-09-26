import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { createIntentBus, INTENT_ORDER } from "../src/input/intentBus";
import type { InputIntent } from "../src/input/inputIntent";
import { createMouseKeyboardTranslator, type ArmedTools } from "../src/input/mouseKeyboardTranslator";
import { createTouchTranslator } from "../src/input/touchTranslator";
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
import { canvasToWorld } from "../src/render/camera";
import { pickTile } from "../src/render/picking";
import { reportInputDevice } from "../src/input/inputDevice";
import { initialOpenPalisadeDraft, type PalisadeDraftState } from "../src/render/palisadeDraftInteraction";

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
function runtimeFor(state: GameState, tool: PlacementTool | null, zoneTool: ZoneBrushTool | null = null, palisadeDraft: PalisadeDraftState | null = null) {
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
  const pending: ({ readonly tx: number; readonly ty: number } | null)[] = [];
  const palisadeDraftRef = { current: palisadeDraft };
  bus.subscribe(createCanvasIntentHandler({ canvas, refs, stateRef, selectedToolRef: { current: tool }, palisadeDraftRef, zone,
    dispatch, setSelection: value => { selection = typeof value === "function" ? value(selection as never) : value; }, setHoveredBuilding: () => undefined,
    onPalisadeDraftChange: undefined, clampCamera, viewport: () => RECT, world, markUserControlled: () => undefined,
    setPending: tile => { refs.pendingPlacement.current = tile; pending.push(tile); } }), INTENT_ORDER.world);
  const translator = createMouseKeyboardTranslator({ bounds: () => RECT, camera: () => refs.cameraRef.current, world,
    armed: () => ({ zone: zoneToolRef.current !== null, zonePolygon: false, palisade: palisadeDraftRef.current !== null, road: tool === "road" }),
    emit: (intent, context) => bus.emit(intent, context), setTimeout: () => 1, clearTimeout: () => undefined });
  const client = (tx: number, ty: number) => {
    const screen = tileToScreen(tx, ty);
    return { clientX: screen.sx * refs.cameraRef.current.zoom + refs.cameraRef.current.panX, clientY: screen.sy * refs.cameraRef.current.zoom + refs.cameraRef.current.panY };
  };
  return { translator, actions, stateRef, refs, client, bus, pending, palisadeDraftRef, selection: () => selection, touch: createTouchTranslator({ bounds: () => RECT, camera: () => refs.cameraRef.current,
    armed: () => ({ zone: zoneToolRef.current !== null, zonePolygon: false, palisade: false, road: tool === "road", tool: tool !== null || zoneToolRef.current !== null,
      building: tool !== null && tool !== "road" && zoneToolRef.current === null }),
    emit: intent => bus.emit(intent), mouse: translator, setTimeout: () => 1, clearTimeout: () => undefined }) };
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

test("UX-3R2 road click-click: a click toggles one tile as before (and on open ground anchors a chain); a click on the anchor toggles it back", () => {
  const run = runtimeFor(DEFAULT_GAME_STATE, "road");
  const tile = { tx: 40, ty: 46 };
  assert.equal(getTile(DEFAULT_GAME_STATE, tile)?.hasRoad, false);
  const point = run.client(tile.tx, tile.ty);
  const click = () => { run.translator.pointerDown({ button: 0, ...point }); run.translator.pointerUp({ button: 0, ...point }); run.translator.click(point); };
  click();
  assert.equal(getTile(run.stateRef.current, tile)?.hasRoad, true, "one click lays the tile, as the old single click did");
  assert.deepEqual(run.refs.roadChain.current, tile, "and anchors a chain there");
  click();
  assert.equal(getTile(run.stateRef.current, tile)?.hasRoad, false, "a click on the anchor removes it again (the old second click)");
  assert.equal(run.actions.length, 2);
  assert.equal(run.refs.roadChain.current, null, "the toggle ends the chain");
});

test("UX-3R2 road click-click: each next click lays the road from the anchor and anchors there; Enter ends, Esc ends without disarming", () => {
  const run = runtimeFor(DEFAULT_GAME_STATE, "road");
  const click = (tx: number, ty: number) => { const p = run.client(tx, ty); run.translator.pointerMove(p); run.translator.pointerDown({ button: 0, ...p }); run.translator.pointerUp({ button: 0, ...p }); run.translator.click(p); };
  click(43, 44); click(47, 44);
  const single = resolveRoadPlacementAttempt({ state: DEFAULT_GAME_STATE, start: { tx: 43, ty: 44 }, destination: { tx: 43, ty: 44 }, nowMs: 0 });
  const afterSingle = single.action === null ? DEFAULT_GAME_STATE : gameReducer(DEFAULT_GAME_STATE, single.action);
  const line = resolveRoadPlacementAttempt({ state: afterSingle, start: { tx: 43, ty: 44 }, destination: { tx: 47, ty: 44 }, nowMs: 0 }).action;
  assert.deepEqual(run.actions, [single.action, line], "the first tile, then the line from it (as a drag from 43,44 to 47,44)");
  assert.deepEqual(run.refs.roadChain.current, { tx: 47, ty: 44 });
  run.translator.keyDown({ code: "Enter", key: "Enter", target: null });
  assert.equal(run.refs.roadChain.current, null);
  click(40, 46);
  assert.deepEqual(run.refs.roadChain.current, { tx: 40, ty: 46 });
  const consumed = run.bus.emit({ kind: "cancel" });
  assert.equal(consumed, true, "Esc on a chain is consumed by the map (the app's one-step Esc does not see it)");
  assert.equal(run.refs.roadChain.current, null);
  // A double click ends a chain (confirm) and lays nothing itself.
  const before = run.actions.length;
  click(41, 46); const p = run.client(44, 46);
  run.translator.pointerMove(p); run.translator.pointerDown({ button: 0, ...p, detail: 2 }); run.translator.pointerUp({ button: 0, ...p }); run.translator.click(p);
  assert.equal(run.refs.roadChain.current, null);
  assert.equal(run.actions.length, before + 1, "only the first click's tile");
});

test("UX-3R2 tablet: a finger positions the ghost 80 px above it; lifting builds nothing; ✓ (confirm) builds there and the tool stays", () => {
  const run = runtimeFor(DEFAULT_GAME_STATE, "house");
  reportInputDevice("touch");
  const finger = run.client(50, 50);
  run.touch.start([finger]); run.touch.move([{ ...finger, clientX: finger.clientX + 1 }]); run.touch.end(0);
  assert.equal(run.actions.length, 0, "lifting the finger does not build");
  const ghost = run.refs.pendingPlacement.current;
  assert.ok(ghost !== null);
  const above = { clientX: finger.clientX + 1, clientY: finger.clientY - 80 };
  const aboveTile = pickTile(canvasToWorld({ x: above.clientX - RECT.left, y: above.clientY - RECT.top }, run.refs.cameraRef.current));
  assert.deepEqual(ghost, aboveTile, "the ghost is the tile 80 px above the finger");
  const cameraBefore = run.refs.cameraRef.current;
  run.bus.emit({ kind: "confirm" });
  const expected = resolveBuildingPlacementAttempt({ state: DEFAULT_GAME_STATE, tool: "house", tile: ghost!, nowMs: 0 }).action;
  assert.deepEqual(run.actions, expected === null ? [] : [expected]);
  assert.equal(run.refs.pendingPlacement.current, null);
  assert.equal(run.refs.cameraRef.current, cameraBefore, "one finger did not pan");
  run.touch.start([finger]); run.touch.end(0);
  assert.ok(run.refs.pendingPlacement.current !== null);
  assert.equal(run.bus.emit({ kind: "cancel" }), true, "✕ / Esc drops the waiting spot first");
  assert.equal(run.refs.pendingPlacement.current, null);
  reportInputDevice("mouse");
});

test("UX-3R2 zone: Shift+Z redoes the undone stroke; a right click with no gesture erases a brush dab", () => {
  const run = runtimeFor(DEFAULT_GAME_STATE, null, { target: "pasture", radius: 2, polygon: false });
  const a = run.client(20, 60); const b = run.client(24, 60);
  run.translator.pointerDown({ button: 0, ...a }); run.translator.pointerMove(b); run.translator.pointerUp({ button: 0, ...b });
  const painted = run.stateRef.current.zones?.[0]?.membership.length ?? 0;
  run.translator.keyDown({ code: "KeyZ", key: "z", target: null });
  assert.equal(run.stateRef.current.zones?.length ?? 0, 0);
  run.translator.keyDown({ code: "KeyZ", key: "Z", target: null, shiftKey: true });
  assert.equal(run.stateRef.current.zones?.[0]?.membership.length, painted, "redo paints the same cells again");
  run.translator.contextMenu(run.client(22, 60));
  assert.deepEqual(run.actions.map(action => action.type), ["zone_paint", "zone_undo_stroke", "zone_paint", "zone_erase"]);
  assert.ok((run.stateRef.current.zones?.[0]?.membership.length ?? 0) < painted);
});

test("UX-3R2 palisade click-click: in the open draw each click extends the line from its end", () => {
  const draft = initialOpenPalisadeDraft();
  const run = runtimeFor(DEFAULT_GAME_STATE, null, null, draft);
  const handlerDraft = () => run.palisadeDraftRef.current;
  run.bus.emit({ kind: "select", world: canvasToWorld({ x: run.client(40, 40).clientX - RECT.left, y: run.client(40, 40).clientY - RECT.top }, run.refs.cameraRef.current) });
  assert.equal(handlerDraft()?.path.length, 1);
  run.bus.emit({ kind: "select", world: canvasToWorld({ x: run.client(44, 40).clientX - RECT.left, y: run.client(44, 40).clientY - RECT.top }, run.refs.cameraRef.current) });
  assert.ok((handlerDraft()?.path.length ?? 0) > 2, "a snapped run from the first point to the second");
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
