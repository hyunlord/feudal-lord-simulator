import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCanvasKeyDown } from '../src/render/canvasKeyboardResolution';

test('O no longer toggles legacy outlines while its button remains independent', () => {
  const result = resolveCanvasKeyDown({ code: 'KeyO', key: 'o', camera: { zoom: 1, panX: 0, panY: 0 },
    spacePressed: false, viewport: { width: 1600, height: 1100 }, world: { minX: 0, minY: 0, maxX: 100, maxY: 100 } });
  assert.equal(result.toggleOutlinesView, false);
  assert.equal(result.preventDefault, false);
});

import { groupCauseMarkers, hitCauseMarker } from '../src/render/causeMarkerLayout';

test('low zoom groups only nearby equal causes and preserves all member hit targets', () => {
  const markers = [
    { x: 0, y: 0, buildingIds: ['a'], causeId: 'water', risk: false },
    { x: 20, y: 0, buildingIds: ['b'], causeId: 'water', risk: true },
    { x: 20, y: 0, buildingIds: ['c'], causeId: 'bread', risk: false },
    { x: 200, y: 0, buildingIds: ['d'], causeId: 'water', risk: false },
  ];
  assert.equal(groupCauseMarkers(markers, 0.9).length, 4);
  const grouped = groupCauseMarkers(markers, 0.6);
  assert.equal(grouped.length, 3);
  assert.deepEqual(grouped[0]?.buildingIds, ['a', 'b']);
  assert.equal(grouped[0]?.risk, true);
  assert.equal(hitCauseMarker(grouped, { x: 200, y: 0 }, 0.6)?.buildingIds[0], 'd');
});

import { isProblemViewShortcut } from '../src/ui/problemViewShortcut';
test('problem-only shortcut ignores repeat and editable focus', () => {
  assert.equal(isProblemViewShortcut('KeyO', false, false), true);
  assert.equal(isProblemViewShortcut('KeyO', true, false), false);
  assert.equal(isProblemViewShortcut('KeyO', false, true), false);
  assert.equal(isProblemViewShortcut('Escape', false, false), false);
});


test('low zoom clusters transitive neighbors with a deterministic anchor regardless of input order', () => {
  const markers = [
    { x: 0, y: 0, buildingIds: ['a'], causeId: 'water', risk: false },
    { x: 50, y: 0, buildingIds: ['b'], causeId: 'water', risk: false },
    { x: 100, y: 0, buildingIds: ['c'], causeId: 'water', risk: true },
  ];
  const grouped = groupCauseMarkers(markers, 0.6);
  assert.deepEqual(grouped, [{ ...markers[0], buildingIds: ['a', 'b', 'c'], risk: true }]);
  assert.deepEqual(groupCauseMarkers([...markers].reverse(), 0.6), grouped);
});
