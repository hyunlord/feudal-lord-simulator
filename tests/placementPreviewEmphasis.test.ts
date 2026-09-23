import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { drawPlacementPrediction } from '../src/render/placementPredictionOverlay';
import { TILE_H, TILE_W } from '../src/render/iso';

test('range and target footprints have translucent fill and zoom-stable strong borders without changing geometry', () => {
  // Given
  const state = DEFAULT_GAME_STATE;
  const house = state.buildings.find(building => building.kind === 'house');
  assert.ok(house);
  const ellipses: number[][] = [];
  const fills: string[] = [];
  const strokes: number[] = [];
  const context = {
    lineCap: 'round' as const, lineJoin: 'round' as const, lineWidth: 0, strokeStyle: '', fillStyle: '',
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, setLineDash() {},
    ellipse(x: number, y: number, rx: number, ry: number) { ellipses.push([x, y, rx, ry]); },
    fill() { fills.push(this.fillStyle); }, stroke() { strokes.push(this.lineWidth); },
  };
  // When
  drawPlacementPrediction(context, state, {
    lines: [], houseIds: [house.id], range: { center: { tx: 20, ty: 20 }, radius: 12 },
    roadSegments: [], placement: { ok: true },
  }, 0.6);
  // Then
  assert.equal(fills.length, 2);
  assert.ok(fills.every(fill => fill.startsWith('rgba(')));
  assert.deepEqual(strokes.map(width => width * 0.6), [3, 3]);
  assert.equal(ellipses[0]?.[2], 12 * TILE_W / Math.SQRT2);
  assert.equal(ellipses[0]?.[3], 12 * TILE_H / Math.SQRT2);
});
