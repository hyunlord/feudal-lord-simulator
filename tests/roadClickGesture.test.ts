import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { getTile } from "../src/world/grid";
import { beginCanvasDrag, finishedRoadAttempt } from "../src/render/canvasDragResolution";
import { resolveCanvasClick } from "../src/render/canvasClickResolution";
import type { GameState } from "../src/engine/engine.types";

const tile = { tx: 44, ty: 41 };
function clickRoad(state: GameState): GameState {
  const { drag } = beginCanvasDrag({ button: 0, point: { x: 100, y: 100 }, hover: tile, spacePressed: false, selectedTool: "road" });
  const released = finishedRoadAttempt(state, drag, tile, 0);
  let next = released?.action === null || released === null ? state : gameReducer(state, released.action);
  const clicked = resolveCanvasClick({ suppressClick: false, spacePressed: false, dragMode: "none", hover: tile, selectedTool: "road", state: next, point: { x: 100, y: 100 }, viewport: { width: 1000, height: 800 }, nowMs: 1 });
  if (clicked.kind === "placement" && clicked.attempt.action !== null) next = gameReducer(next, clicked.attempt.action);
  return next;
}

test("one click places an empty road tile exactly once", () => {
  const before = gameReducer(DEFAULT_GAME_STATE, { type: "remove_road", ...tile });
  const after = clickRoad(before);
  assert.equal(getTile(after, tile)?.hasRoad, true);
  assert.equal(after.roadRevision, before.roadRevision + 1);
});

test("one click removes an existing road tile exactly once", () => {
  const after = clickRoad(DEFAULT_GAME_STATE);
  assert.equal(getTile(after, tile)?.hasRoad, false);
  assert.equal(after.roadRevision, DEFAULT_GAME_STATE.roadRevision + 1);
});

test("a moved road gesture commits its line and its following click is suppressed", () => {
  const { drag } = beginCanvasDrag({ button: 0, point: { x: 100, y: 100 }, hover: tile, spacePressed: false, selectedTool: "road" });
  const attempt = finishedRoadAttempt(DEFAULT_GAME_STATE, { ...drag, roadStart: { tx: 43, ty: 44 }, moved: true }, { tx: 47, ty: 44 }, 0);
  assert.equal(attempt?.action?.type, "place_road_line");
  const click = resolveCanvasClick({ suppressClick: true, spacePressed: false, dragMode: "none", hover: tile, selectedTool: "road", state: DEFAULT_GAME_STATE, point: { x: 100, y: 100 }, viewport: { width: 1000, height: 800 }, nowMs: 1 });
  assert.equal(click.kind, "ignored");
});
