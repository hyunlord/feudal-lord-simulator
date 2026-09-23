import assert from 'node:assert/strict';
import test from 'node:test';

import { PALETTE, SEMANTIC_PALETTE } from '../src/content/palette';
import { drawPalisadeRoutePreviewOverlay, type PalisadeRoutePreviewContext } from '../src/render/palisadeRoutePreviewOverlay';

test('unreachable draft wall draws a thick dashed warning and a cross without changing reachable runs', () => {
  const calls: string[] = [];
  const context: PalisadeRoutePreviewContext = {
    lineCap: 'butt',
    lineJoin: 'miter',
    lineWidth: 1,
    strokeStyle: '',
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    stroke: () => calls.push(`stroke:${context.strokeStyle}:${context.lineWidth}`),
    setLineDash: (pattern: number[]) => calls.push(`dash:${pattern.join(',')}`),
  };

  drawPalisadeRoutePreviewOverlay(context, [[{ x: 1, y: 1 }, { x: 5, y: 1 }]], 1);

  assert.ok(calls.includes('dash:8,6'));
  assert.ok(calls.includes(`stroke:${PALETTE.vermilion}:5`));
  assert.ok(calls.includes(`stroke:${SEMANTIC_PALETTE.vellum}:3`));
  assert.ok(calls.includes('moveTo:0,16'));
  assert.ok(calls.includes('lineTo:128,80'));
  assert.equal(calls.filter(call => call === 'save').length, 1);
  assert.equal(calls.filter(call => call === 'restore').length, 1);
});
