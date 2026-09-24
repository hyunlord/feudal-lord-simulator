import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/engine/engine.types';
import type { Tile } from '../src/world/world.types';
import { applyPalisadeIntent, initialOpenPalisadeDraft } from '../src/render/palisadeDraftInteraction';
import { advancePalisadeDraftDrag, beginPalisadeDraftDrag, finishPalisadeDraftDrag,
  palisadeEdgePointAtCanvas } from '../src/render/canvasPalisadeDraftRuntime';
import { tileToScreen } from '../src/render/iso';

const tiles: Tile[] = Array.from({ length: 24 * 24 }, (_, index) => ({
  tx: index % 24, ty: Math.floor(index / 24), terrain: 'grass', buildingId: null, hasRoad: false,
}));
const state: GameState = {
  ...DEFAULT_GAME_STATE,
  width: 24,
  height: 24,
  tiles,
  buildings: [{ id: 'house-a', kind: 'house', tx: 9, ty: 9, workers: 0,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 }],
  houses: [],
  constructionSites: [],
};

function drawStroke(
  draft: NonNullable<ReturnType<typeof initialOpenPalisadeDraft>>,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const began = applyPalisadeIntent({ state, draft, intent: { type: 'strokeBegin', point: from } });
  assert.ok(began);
  const moved = applyPalisadeIntent({ state, draft: began, intent: { type: 'strokeMove', point: to } });
  assert.ok(moved);
  const ended = applyPalisadeIntent({ state, draft: moved, intent: { type: 'strokeEnd' } });
  assert.ok(ended);
  return ended;
}

test('drawn strokes remain open until they return to the first vertex, then use the proclamation validator', () => {
  let draft = initialOpenPalisadeDraft();
  for (const [from, to] of [
    [{ x: 4, y: 4 }, { x: 16, y: 4 }],
    [{ x: 16, y: 4 }, { x: 16, y: 16 }],
    [{ x: 16, y: 16 }, { x: 4, y: 16 }],
  ] as const) draft = drawStroke(draft, from, to);
  assert.equal(draft.candidate, null);
  assert.equal(draft.failureReason, 'open_polygon');
  draft = drawStroke(draft, { x: 4, y: 16 }, { x: 4, y: 4 });
  assert.ok(draft.candidate);
  assert.equal(draft.candidate.path.at(-1)?.x, 4);
  assert.equal(draft.failureReason, null);
});

test('undo and cancel remove a complete stroke, with the second cancel discarding the draft', () => {
  const first = drawStroke(initialOpenPalisadeDraft(), { x: 4, y: 4 }, { x: 16, y: 4 });
  const second = drawStroke(first, { x: 16, y: 4 }, { x: 16, y: 16 });
  const undone = applyPalisadeIntent({ state, draft: second, intent: { type: 'undo' } });
  assert.ok(undone);
  assert.deepEqual(undone.path, first.path);
  const cleared = applyPalisadeIntent({ state, draft: undone, intent: { type: 'cancel' } });
  assert.ok(cleared);
  assert.deepEqual(cleared.path, []);
  assert.equal(applyPalisadeIntent({ state, draft: cleared, intent: { type: 'cancel' } }), null);
});

test('two cancels discard a multi-stroke draft while undo still removes only one stroke', () => {
  let draft = initialOpenPalisadeDraft();
  for (const [from, to] of [
    [{ x: 4, y: 4 }, { x: 16, y: 4 }],
    [{ x: 16, y: 4 }, { x: 16, y: 16 }],
    [{ x: 16, y: 16 }, { x: 4, y: 16 }],
  ] as const) draft = drawStroke(draft, from, to);
  const once = applyPalisadeIntent({ state, draft, intent: { type: 'cancel' } });
  assert.ok(once);
  assert.deepEqual(once.path.at(-1), { x: 16, y: 16 });
  assert.equal(applyPalisadeIntent({ state, draft: once, intent: { type: 'cancel' } }), null);
});

test('a closed draft can erase one run and reconnect its two open endpoints', () => {
  let draft = initialOpenPalisadeDraft();
  for (const [from, to] of [
    [{ x: 4, y: 4 }, { x: 16, y: 4 }],
    [{ x: 16, y: 4 }, { x: 16, y: 16 }],
    [{ x: 16, y: 16 }, { x: 4, y: 16 }],
    [{ x: 4, y: 16 }, { x: 4, y: 4 }],
  ] as const) draft = drawStroke(draft, from, to);
  assert.ok(draft.candidate);
  const erased = applyPalisadeIntent({ state, draft, intent: { type: 'eraseSegment', index: 0 } });
  assert.ok(erased);
  assert.equal(erased.candidate, null);
  assert.equal(erased.failureReason, 'open_polygon');
  const repaired = drawStroke(erased, { x: 16, y: 4 }, { x: 4, y: 4 });
  assert.ok(repaired.candidate);
});

test('canvas pointer input snaps to the displayed wall vertex and commits one stroke on release', () => {
  const camera = { zoom: 1.5, panX: 240, panY: 110 };
  const canvasAt = (x: number, y: number) => {
    const screen = tileToScreen(x, y);
    return { x: screen.sx * camera.zoom + camera.panX,
      y: (screen.sy - 16) * camera.zoom + camera.panY };
  };
  assert.deepEqual(palisadeEdgePointAtCanvas(canvasAt(4, 4), camera), { x: 4, y: 4 });
  const began = beginPalisadeDraftDrag({ state, draft: initialOpenPalisadeDraft(), button: 0,
    hover: null, point: canvasAt(4, 4), camera });
  assert.ok(began);
  const moved = advancePalisadeDraftDrag({ state, draft: began.draft, drag: began.drag,
    hover: null, point: canvasAt(16, 4), camera });
  assert.ok(moved);
  const ended = finishPalisadeDraftDrag(state, moved);
  assert.ok(ended);
  assert.deepEqual(ended.path.at(-1), { x: 16, y: 4 });
  assert.equal(ended.strokes.length, 1);
});
