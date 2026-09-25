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

type TestMarker = Parameters<typeof groupCauseMarkers>[0][number];
const marker = (id: string, tx: number, ty: number, causeId: string | null, severity: 'block' | 'warn' | null): TestMarker =>
  ({ x: (tx - ty) * 32, y: (tx + ty) * 16, buildingIds: [id], tile: { tx, ty }, causeId, severity });

test('zoomed out below 0.8, every cause in a 6x6 cell merges into one counted marker led by the most urgent', () => {
  const markers = [marker('a', 0, 0, 'water', 'warn'), marker('b', 3, 2, 'bread', 'block'),
    marker('c', 7, 1, 'water', 'warn'), marker('d', 1, 1, null, null)];
  assert.equal(groupCauseMarkers(markers, 0.8).length, 4, 'at 0.8 and above every building keeps its own marker');
  const grouped = groupCauseMarkers(markers, 0.6);
  assert.equal(grouped.length, 2, 'one marker per occupied cell; the promotion ring drops out');
  assert.deepEqual(grouped[0]?.buildingIds, ['a', 'b']);
  assert.equal(grouped[0]?.severity, 'block');
  assert.equal(grouped[0]?.causeId, 'bread');
  assert.equal(grouped[0]?.x, (markers[0]!.x + markers[1]!.x) / 2);
  assert.equal(grouped[0]?.y, (markers[0]!.y + markers[1]!.y) / 2);
  assert.deepEqual(grouped[1]?.buildingIds, ['c']);
  assert.equal(hitCauseMarker(grouped, { x: markers[2]!.x, y: markers[2]!.y }, 0.6)?.buildingIds[0], 'c');
});

test('cell clusters are deterministic regardless of input order', () => {
  const markers = [marker('a', 0, 0, 'water', 'warn'), marker('b', 5, 5, 'water', 'warn'), marker('c', 2, 4, 'bread', 'warn')];
  const grouped = groupCauseMarkers(markers, 0.5);
  assert.equal(grouped.length, 1);
  assert.deepEqual(grouped[0]?.buildingIds, ['a', 'b', 'c']);
  assert.equal(grouped[0]?.causeId, 'water', 'with no immediate member the first caution leads');
  assert.deepEqual(groupCauseMarkers([...markers].reverse(), 0.5), grouped);
});

import { isProblemViewShortcut } from '../src/ui/problemViewShortcut';
test('problem-only shortcut ignores repeat and editable focus', () => {
  assert.equal(isProblemViewShortcut('KeyO', false, false), true);
  assert.equal(isProblemViewShortcut('KeyO', true, false), false);
  assert.equal(isProblemViewShortcut('KeyO', false, true), false);
  assert.equal(isProblemViewShortcut('Escape', false, false), false);
});

