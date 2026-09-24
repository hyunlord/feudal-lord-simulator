import assert from 'node:assert/strict';
import test from 'node:test';
import { placeRoadLine } from '../src/engine/gameActions';
import { roadPlacementAssessment, roadTimberCost } from '../src/engine/roadPlacement';
import { resolveRoadPlacementAttempt } from '../src/render/roadInteractionAttempts';
import { roadPlacementPrediction } from '../src/ui/placementPrediction';
import { PlacementFailure } from '../src/world/placement';
import { canTraverseWallBoundary } from '../src/world/wallTraversal';
import { bridgeAt } from '../src/world/bridges';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';

const line = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, offset) => ({ tx: from + offset, ty: 2 }));

function grid(existing: readonly number[] = [], building: number | null = null) {
  return {
    ...DEFAULT_GAME_STATE, width: 8, height: 5, treasuryTimber: 40,
    buildings: [], constructionSites: [], palisade: null,
    tiles: Array.from({ length: 40 }, (_, index) => {
      const tx = index % 8, ty = Math.floor(index / 8);
      return { tx, ty, terrain: 'grass' as const, hasRoad: ty === 2 && existing.includes(tx),
        buildingId: ty === 2 && tx === building ? 'blocking-house' : null };
    }),
  };
}

test('T5: crossing an existing road charges and installs only new tiles', () => {
  const state = grid([0, 3]);
  const path = line(0, 5);
  const assessment = roadPlacementAssessment(state, path);
  assert.equal(assessment.failure, null);
  assert.deepEqual(assessment.existingTiles, [{ tx: 0, ty: 2 }, { tx: 3, ty: 2 }]);
  assert.deepEqual(assessment.newTiles, [1, 2, 4, 5].map(tx => ({ tx, ty: 2 })));
  assert.equal(roadTimberCost(state, path), 0);
  const next = placeRoadLine(state, path[0]!, path.at(-1)!);
  assert.notEqual(next, state);
  assert.equal(next.tiles.filter(tile => tile.ty === 2 && tile.hasRoad).length, 6);
  assert.equal(next.roadRevision, state.roadRevision + 1);
  assert.match(roadPlacementPrediction(state, path).lines.find(row => row.id === 'road-cost')?.text ?? '', /새 길 4칸 · 기존 길 2칸 통과/);
});

test('T6: building on a drag rejects the full road line', () => {
  const state = grid([0, 3], 4);
  const path = line(0, 5);
  assert.equal(roadPlacementAssessment(state, path).failure, PlacementFailure.occupied);
  assert.equal(placeRoadLine(state, path[0]!, path.at(-1)!), state);
});

test('out-of-map cells still reject the entire road drag', () => {
  const state = grid([0]);
  const path = line(0, 8);
  assert.equal(roadPlacementAssessment(state, path).failure, PlacementFailure.out_of_bounds);
  assert.equal(placeRoadLine(state, path[0]!, path.at(-1)!), state);
});

test('T7: an all-existing road drag is a no-op with an explicit explanation', () => {
  const state = grid([0, 1, 2, 3]);
  const path = line(0, 3);
  assert.deepEqual(roadPlacementAssessment(state, path).newTiles, []);
  assert.equal(placeRoadLine(state, path[0]!, path.at(-1)!), state);
  const attempt = resolveRoadPlacementAttempt({ state, start: path[0]!, destination: path.at(-1)!, nowMs: 0 });
  assert.equal(attempt.action, null);
  assert.equal(attempt.feedback.message, '이미 길이 있습니다');
  assert.equal(roadPlacementPrediction(state, path).lines.find(row => row.id === 'placement')?.text, '이미 길이 있습니다');
});

test('crossing an existing bridge charges only newly placed water tiles', () => {
  const base = grid([1, 5]);
  const river = { ...base, tiles: base.tiles.map(tile => tile.ty === 2 && tile.tx >= 2 && tile.tx <= 4
    ? { ...tile, terrain: 'water' as const } : tile) };
  const initial = placeRoadLine(river, { tx: 1, ty: 2 }, { tx: 5, ty: 2 });
  const extended = placeRoadLine(initial, { tx: 0, ty: 2 }, { tx: 6, ty: 2 });
  assert.notEqual(extended, initial);
  assert.equal(initial.treasuryTimber, 28);
  assert.equal(extended.treasuryTimber, 28);
  assert.deepEqual(roadPlacementAssessment(initial, line(0, 6)).newTiles,
    [{ tx: 0, ty: 2 }, { tx: 6, ty: 2 }]);
});

test('a drag crosses two finished bridges while adding only the intervening grass roads', () => {
  const state = { ...DEFAULT_GAME_STATE, width: 12, height: 5, treasuryTimber: 40,
    buildings: [], constructionSites: [], palisade: null,
    tiles: Array.from({ length: 60 }, (_, index) => {
      const tx = index % 12, ty = Math.floor(index / 12);
      return { tx, ty, terrain: ty === 2 && [2, 3, 7, 8].includes(tx) ? 'water' as const : 'grass' as const,
        hasRoad: ty === 2 && [1, 2, 3, 4, 6, 7, 8, 9].includes(tx), buildingId: null };
    }),
  };
  assert.ok(bridgeAt(state, { tx: 2, ty: 2 }) !== null);
  assert.ok(bridgeAt(state, { tx: 7, ty: 2 }) !== null);
  const path = Array.from({ length: 11 }, (_, tx) => ({ tx, ty: 2 }));
  assert.equal(roadPlacementAssessment(state, path).failure, null);
  const placed = placeRoadLine(state, path[0]!, path.at(-1)!);
  assert.notEqual(placed, state);
  assert.equal(placed.treasuryTimber, state.treasuryTimber);
  assert.deepEqual(roadPlacementAssessment(state, path).newTiles, [0, 5, 10].map(tx => ({ tx, ty: 2 })));
});

test('a new grass bank can complete a pre-existing water road during the same drag', () => {
  const base = grid([2, 3, 4]);
  const state = { ...base, tiles: base.tiles.map(tile => tile.ty === 2 && [2, 3].includes(tile.tx)
    ? { ...tile, terrain: 'water' as const } : tile) };
  assert.equal(bridgeAt(state, { tx: 2, ty: 2 }), null);
  const path = line(0, 5);
  assert.equal(roadPlacementAssessment(state, path).failure, null);
  const placed = placeRoadLine(state, path[0]!, path.at(-1)!);
  assert.ok(bridgeAt(placed, { tx: 2, ty: 2 }) !== null);
  assert.equal(placed.treasuryTimber, state.treasuryTimber);
});

test('a road drag across a completed palisade keeps pre-F2 placement behavior without opening a new gate', () => {
  const base = grid();
  const state = { ...base, palisade: {
    id: 'completed-wall', polygon: [], gate: { x: 3, y: 5 },
    segments: [{ id: 'wall-segment', order: 0, gateDistance: 0,
      edgePath: [{ x: 3, y: 0 }, { x: 3, y: 5 }], tileCount: 5,
      completed: true, constructionSiteId: null, material: 'timber' as const }],
  } };
  const path = line(1, 5);
  assert.equal(canTraverseWallBoundary(state, path[1]!, path[2]!), false);
  assert.equal(roadPlacementAssessment(state, path).failure, null);
  const placed = placeRoadLine(state, path[0]!, path.at(-1)!);
  assert.notEqual(placed, state);
  assert.ok(path.every(point => placed.tiles.some(tile => tile.tx === point.tx && tile.ty === point.ty && tile.hasRoad)));
  assert.deepEqual(placed.palisade?.additionalGates ?? [], []);
  assert.equal(canTraverseWallBoundary(placed, path[1]!, path[2]!), false);
});
