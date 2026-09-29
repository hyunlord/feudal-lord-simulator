import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { createIntentBus, INTENT_ORDER } from "../src/input/intentBus";
import type { InputIntent } from "../src/input/inputIntent";
import { createMouseKeyboardTranslator } from "../src/input/mouseKeyboardTranslator";
import { clampPan, type CameraState } from "../src/render/camera";
import { createCanvasIntentHandler } from "../src/render/canvasIntentHandler";
import { createCanvasMutableRefs } from "../src/render/canvasRuntimeRefs";
import { createZoneBrushContext } from "../src/render/canvasZoneBrushRuntime";
import { placementPreview, worldBounds } from "../src/render/interactions";
import { tileToScreen } from "../src/render/iso";
import type { PlacementTool } from "../src/render/renderer";
import type { ZoneBrushTool } from "../src/render/zoneBrushInteraction";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";

// SMOOTH-2R placement drag: the DOM's mouse moves are queued and handled once per frame from the last one. A drag fed
// that way (many moves a frame, then the release) must place exactly what the same moves handled one by one placed,
// and leave the same preview behind, with one hover and one road step per frame.

const RECT = { left: 0, top: 0, width: 1280, height: 800 };
const VIEW = { width: RECT.width, height: RECT.height };

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
  const hovers: unknown[] = [];
  bus.subscribe(createCanvasIntentHandler({ canvas, refs, stateRef, selectedToolRef: { current: tool }, palisadeDraftRef: { current: null }, zone,
    dispatch, setSelection: () => undefined, setHoveredBuilding: value => { hovers.push(value); }, onPalisadeDraftChange: undefined, clampCamera,
    viewport: () => RECT, world, markUserControlled: () => undefined }), INTENT_ORDER.world);
  const emitted: InputIntent["kind"][] = [];
  const translator = createMouseKeyboardTranslator({ bounds: () => RECT, camera: () => refs.cameraRef.current, world,
    armed: () => ({ zone: zoneToolRef.current !== null, zonePolygon: false, palisade: false, road: tool === "road" }),
    emit: (intent, context) => { emitted.push(intent.kind); return bus.emit(intent, context); },
    setTimeout: () => 1, clearTimeout: () => undefined, now: () => 0 });
  const client = (tx: number, ty: number, dx = 0, dy = 0) => {
    const screen = tileToScreen(tx, ty);
    return { clientX: screen.sx + refs.cameraRef.current.panX + dx, clientY: screen.sy + refs.cameraRef.current.panY + dy };
  };
  const count = (kind: InputIntent["kind"]) => emitted.filter(item => item === kind).length;
  return { translator, actions, refs, stateRef, client, count, hovers };
}

type Point = { readonly clientX: number; readonly clientY: number };
/** A wandering drag: `frames` frames of `perFrame` moves each. */
function path(run: ReturnType<typeof runtimeFor>, from: [number, number], frames: number, perFrame: number): Point[][] {
  return Array.from({ length: frames }, (_, frame) => Array.from({ length: perFrame }, (_, index) => {
    const step = frame * perFrame + index + 1;
    return run.client(from[0] + Math.floor(step / 3), from[1], (step % 5) * 3, Math.round(Math.sin(step / 2) * 9));
  }));
}

function dragBothWays(state: GameState, tool: PlacementTool | null, zoneTool: ZoneBrushTool | null, from: [number, number], frames: number, perFrame: number,
  frameBeforeRelease = true) {
  const direct = runtimeFor(state, tool, zoneTool); const queued = runtimeFor(state, tool, zoneTool);
  const moves = path(direct, from, frames, perFrame);
  const start = direct.client(from[0], from[1]); const end = moves.at(-1)!.at(-1)!;
  direct.translator.pointerDown({ button: 0, ...start });
  queued.translator.pointerDown({ button: 0, ...start });
  const pointsBefore = queued.count("point");
  moves.forEach((frame, index) => {
    for (const move of frame) direct.translator.pointerMove(move);
    for (const move of frame) queued.translator.queueMove(move);
    // Both runs get the frames (held keys and edge scrolling move the camera there, between the moves).
    if (index < moves.length - 1 || frameBeforeRelease) for (const run of [direct, queued]) run.translator.frame(index * 16, (index - 1) * 16, VIEW);
  });
  const pointsDuringDrag = queued.count("point") - pointsBefore;
  const previews = [direct, queued].map(run => placementPreview(run.stateRef.current, tool, run.refs.hoverRef.current, run.refs.dragRef.current.roadStart));
  const drags = [direct, queued].map(run => run.refs.dragRef.current);
  direct.translator.pointerUp({ button: 0, ...end }); direct.translator.click(end);
  queued.translator.pointerUp({ button: 0, ...end }); queued.translator.click(end);
  return { direct, queued, previews, drags, pointsDuringDrag };
}

test("SMOOTH-2R road drag: four moves a frame, handled once a frame, lay the same road and leave the same preview", () => {
  const { direct, queued, previews, drags, pointsDuringDrag } = dragBothWays(DEFAULT_GAME_STATE, "road", null, [40, 44], 6, 4);
  assert.equal(pointsDuringDrag, 6, "one hover per frame (24 moves)");
  assert.equal(queued.count("strokeMove"), 6, "one road step per frame");
  assert.equal(direct.count("strokeMove"), 24);
  assert.deepEqual(previews[1], previews[0], "the preview after the last move is the one-by-one preview");
  assert.ok(previews[0]!.roadPath.length > 2);
  assert.deepEqual(drags[1], drags[0]);
  assert.ok(direct.actions.length === 1 && direct.actions[0]?.type === "place_road_line");
  assert.deepEqual(queued.actions, direct.actions);
  assert.deepEqual(queued.stateRef.current.tiles, direct.stateRef.current.tiles);
});

test("SMOOTH-2R road drag: a release before the frame flushes the queued moves first (the last input places)", () => {
  const { direct, queued, previews } = dragBothWays(DEFAULT_GAME_STATE, "road", null, [40, 44], 3, 5, false);
  assert.notDeepEqual(previews[1], previews[0], "the last frame's moves were still queued at the release");
  assert.deepEqual(queued.actions, direct.actions);
  assert.equal(direct.actions.length, 1);
});

test("SMOOTH-2R zone brush: a coalesced stroke keeps every point of its sweep and paints the same cells", () => {
  const brush: ZoneBrushTool = { target: "pasture", radius: 2, polygon: false };
  const { direct, queued, pointsDuringDrag } = dragBothWays(DEFAULT_GAME_STATE, null, brush, [20, 60], 5, 6);
  assert.equal(pointsDuringDrag, 5, "one hover per frame");
  assert.equal(queued.count("strokeMove"), direct.count("strokeMove"), "the sweep keeps its points");
  assert.ok(direct.actions.length === 1 && direct.actions[0]?.type === "zone_paint");
  assert.deepEqual(queued.actions, direct.actions);
  assert.deepEqual(queued.stateRef.current.zones, direct.stateRef.current.zones);
});

test("SMOOTH-2R pan drag: the camera ends where the one-by-one pan left it; nothing is placed or hovered twice a frame", () => {
  const { direct, queued, pointsDuringDrag } = dragBothWays(DEFAULT_GAME_STATE, null, null, [44, 41], 4, 5);
  assert.equal(pointsDuringDrag, 4);
  assert.equal(queued.count("pan"), 4);
  assert.deepEqual(queued.refs.cameraRef.current, direct.refs.cameraRef.current);
  assert.deepEqual(queued.actions, []);
  assert.deepEqual(direct.actions, []);
});
