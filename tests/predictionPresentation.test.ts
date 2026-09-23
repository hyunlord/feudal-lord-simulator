import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { STARTING_HOUSE_ID } from '../src/state/openingVillage';
import { houseDiagnosisModel } from '../src/ui/houseDiagnosisModel';
import { DiagnosticCard } from '../src/render/DiagnosticCard';

test('L4 inspector names maintenance risk rather than an impossible upgrade blocker', () => {
  const state = { ...DEFAULT_GAME_STATE, houses: DEFAULT_GAME_STATE.houses.map(h => ({ ...h, level: 4 })) };
  const value = houseDiagnosisModel(state, STARTING_HOUSE_ID);
  assert.ok(value);
  const html = renderToStaticMarkup(createElement(DiagnosticCard, { model: { kind: 'house', value }, position: { x: 0, y: 0 },
    causeSummary: { buildingId: STARTING_HOUSE_ID, name: '상인가옥', currentLevel: 4, nextLevel: null, status: 'normal', blocker: null,
      summary: '유지 중', progressTicks: 0, requiredTicks: null, remainingTicks: null } }));
  assert.match(html, /유지 위험: 없음/);
  assert.doesNotMatch(html, /첫 방해/);
});

import { PredictionPanel } from '../src/ui/PredictionPanel';
import { cachedPlacementPreview, createPredictionPublisher } from '../src/render/placementPredictionRuntime';

test('generic prediction panel renders policy lines without facility logic and with noncolour status', () => {
  const html = renderToStaticMarkup(createElement(PredictionPanel, { position: { x: 5, y: 5 }, lines: [
    { id: 'policy', tone: 'warning', text: '정책 적용 시 일꾼 2명 필요' },
    { id: 'zone', tone: 'negative', text: '구역 점유 충돌' },
  ] }));
  assert.match(html, /정책 적용 시 일꾼 2명 필요/);
  assert.match(html, /△/);
  assert.match(html, /×/);
});

test('stationary cursor reuses semantic prediction and does not republish each frame', () => {
  const tile = { tx: 6, ty: 3 };
  const first = cachedPlacementPreview(DEFAULT_GAME_STATE, 'well', tile, null);
  const second = cachedPlacementPreview(DEFAULT_GAME_STATE, 'well', { ...tile }, null);
  assert.equal(second, first);
  let publications = 0;
  const publish = createPredictionPublisher(() => { publications++; });
  const camera = { zoom: .9, panX: 20, panY: 20 };
  publish(first, camera);
  publish(second, { ...camera });
  assert.equal(publications, 1);
  publish(second, { ...camera, panX: 21 });
  assert.equal(publications, 2);
});

test('occupied selected building tile retains an invalid placement reason', () => {
  const building = DEFAULT_GAME_STATE.buildings[0];
  assert.ok(building);
  const preview = cachedPlacementPreview(DEFAULT_GAME_STATE, 'well', building, null);
  assert.equal(preview.ok, false);
  assert.ok(preview.prediction?.lines.some(line => line.text.includes('점유 충돌')));
});

import { cancelRoadPreview } from '../src/render/cancelRoadPreview';
import { createCanvasMutableRefs } from '../src/render/canvasRuntimeRefs';
import { finishedRoadAttempt } from '../src/render/canvasDragResolution';
test('cancelled road drag cannot place or charge on subsequent mouseup', () => {
  const refs = createCanvasMutableRefs({ zoom: 1, panX: 0, panY: 0 });
  refs.dragRef.current = { mode: 'road', roadStart: { tx: 1, ty: 1 }, startCamera: null,
    startCanvasPoint: { x: 0, y: 0 }, lastCanvasPoint: { x: 40, y: 0 }, moved: true };
  assert.equal(cancelRoadPreview(refs), true);
  assert.equal(finishedRoadAttempt(DEFAULT_GAME_STATE, refs.dragRef.current, { tx: 4, ty: 1 }, 0), null);
  assert.equal(refs.suppressClick.current, true);
});

test('prediction cache refreshes state, selected tool, destination and road origin independently', () => {
  const a = cachedPlacementPreview(DEFAULT_GAME_STATE, 'road', { tx: 6, ty: 3 }, { tx: 5, ty: 3 });
  const changedOrigin = cachedPlacementPreview(DEFAULT_GAME_STATE, 'road', { tx: 6, ty: 3 }, { tx: 4, ty: 3 });
  assert.notEqual(a, changedOrigin);
  assert.equal(changedOrigin.roadPath.length, 3);
  assert.notEqual(cachedPlacementPreview(DEFAULT_GAME_STATE, 'well', { tx: 6, ty: 3 }, null), changedOrigin);
  const newState = { ...DEFAULT_GAME_STATE, treasuryTimber: 0 };
  assert.notEqual(cachedPlacementPreview(newState, 'road', { tx: 6, ty: 3 }, { tx: 4, ty: 3 }), changedOrigin);
  assert.notEqual(cachedPlacementPreview(DEFAULT_GAME_STATE, 'road', { tx: 7, ty: 3 }, { tx: 4, ty: 3 }), changedOrigin);
});

test('publisher removes the prediction when selection mode resumes', () => {
  let visible = false;
  const publish = createPredictionPublisher(value => { visible = value !== null; });
  const camera = { zoom: 1, panX: 0, panY: 0 };
  publish(cachedPlacementPreview(DEFAULT_GAME_STATE, 'well', { tx: 6, ty: 3 }, null), camera);
  assert.equal(visible, true);
  publish(cachedPlacementPreview(DEFAULT_GAME_STATE, null, { tx: 6, ty: 3 }, null), camera);
  assert.equal(visible, false);
});

test('idle simulation ticks do not recompute the same tile placement preview', () => {
  const tile = { tx: 6, ty: 3 };
  const first = cachedPlacementPreview(DEFAULT_GAME_STATE, 'well', tile, null);
  const nextTick = { ...DEFAULT_GAME_STATE, tick: DEFAULT_GAME_STATE.tick + 1 };
  assert.equal(cachedPlacementPreview(nextTick, 'well', tile, null), first);
});
