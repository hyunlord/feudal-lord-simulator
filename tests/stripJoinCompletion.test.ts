import assert from 'node:assert/strict';
import test from 'node:test';
import { joinStripImages, featherStripRows } from '../src/render/stripJoin';
import { recordingCanvas } from '../scripts/recordingCanvas';

const a: HTMLImageElement = Object.assign(Object.create(null), { label: 'a', width: 512, height: 64 });
const b: HTMLImageElement = Object.assign(Object.create(null), { label: 'b', width: 512, height: 64 });
function canvasEnvironment(failAt = 0, throwAt = 0, processingFailure = false) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const canvases: { readonly canvas: HTMLCanvasElement; readonly ops: string[] }[] = [];
  let count = 0;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement() {
    count++;
    if (count === throwAt) throw new Error(`allocation ${count}`);
    const recording = recordingCanvas(0, 0);
    if (processingFailure) recording.context.drawImage = () => { throw new Error("draw failure"); };
    const canvas: HTMLCanvasElement = Object.assign(Object.create(null), { width: 0, height: 0, label: `canvas${count}`, getContext: () => count === failAt ? null : recording.context });
    canvases.push({ canvas, ops: recording.canvas.ops });
    return canvas;
  } } });
  return { canvases, restore() {
    if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document');
  } };
}
function complete(failAt = 0, throwAt = 0) {
  const env = canvasEnvironment(failAt, throwAt); const reasons: string[] = [];
  try {
    const result = joinStripImages([a, b], 512, 64, 40, { mode: 'strict', onFailure: reason => reasons.push(reason) });
    return { result, reasons, recordings: env.canvases.map(row => ({ width: row.canvas.width, height: row.canvas.height, ops: [...row.ops] })) };
  } finally { env.restore(); }
}
test('strict completion refuses every main, seam and mask context failure, then recovers', () => {
  // Two strips: one main + two scratch and two mask canvases per seam, including wrap boundary.
  for (let allocation = 1; allocation <= 9; allocation++) {
    const failed = complete(allocation); assert.equal(failed.result, null, `allocation ${allocation}`); assert.equal(failed.reasons.length, 1);
    const recovered = complete(); assert.ok(recovered.result); assert.equal(recovered.reasons.length, 0);
    assert.deepEqual(recovered.recordings.map(row => [row.width, row.height]), [[1024, 64], ...Array.from({ length: 8 }, () => [80, 64])]);
  }
});
test('strict completion catches allocation exceptions while legacy defaults keep their fallback and throws', () => {
  for (let allocation = 1; allocation <= 9; allocation++) assert.equal(complete(0, allocation).result, null);
  for (const allocation of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const env = canvasEnvironment(allocation);
    try {
      const result = joinStripImages([a, b], 512, 64, 40);
      assert.equal(result, allocation === 1 ? a : env.canvases[0]?.canvas);
    } finally { env.restore(); }
  }
  const env = canvasEnvironment(0, 1);
  try { assert.throws(() => joinStripImages([a, b], 512, 64, 40), /allocation 1/); }
  finally { env.restore(); }
});
test('strict and legacy successful blend operation streams are identical', () => {
  const strict = complete(); const env = canvasEnvironment();
  try {
    const legacy = joinStripImages([a, b], 512, 64, 40); assert.ok(legacy);
    assert.deepEqual(env.canvases.map(row => ({ width: row.canvas.width, height: row.canvas.height, ops: [...row.ops] })), strict.recordings);
  } finally { env.restore(); }
});
test('strict DOM-less composition fails explicitly; legacy and feather defaults remain unchanged', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document'); Reflect.deleteProperty(globalThis, 'document');
  try {
    const reasons: string[] = [];
    assert.equal(joinStripImages([a, b], 512, 64, 40, { mode: 'strict', onFailure: reason => reasons.push(reason) }), null);
    assert.match(reasons[0] ?? '', /Strip processing failed/);
    assert.throws(() => joinStripImages([a, b], 512, 64, 40), ReferenceError);
  } finally { if (original) Object.defineProperty(globalThis, 'document', original); }
  const env = canvasEnvironment(1);
  try { assert.equal(featherStripRows(a, 512, 64, () => 1), a); } finally { env.restore(); }
});

test('strict processing exception rejects the whole composition and a later retry recovers', () => {
  const env = canvasEnvironment(0, 0, true); const reasons: string[] = [];
  try {
    assert.equal(joinStripImages([a, b], 512, 64, 40, { mode: 'strict', onFailure: reason => reasons.push(reason) }), null);
    assert.match(reasons[0] ?? '', /draw failure/);
    assert.throws(() => joinStripImages([a, b], 512, 64, 40), /draw failure/);
  } finally { env.restore(); }
  assert.ok(complete().result);
});
test('strict diagnostics safely format arbitrary thrown values and reporting failures propagate once', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    for (const error of [Object.create(null), { toString() { throw new Error('formatting failure'); } }]) {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement() { throw error; } } });
      const reasons: string[] = [];
      assert.equal(joinStripImages([a, b], 512, 64, 40, { mode: 'strict', onFailure: reason => reasons.push(reason) }), null);
      assert.deepEqual(reasons, ['Strip processing failed: Unprintable thrown value']);
    }
  } finally { if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document'); }
  for (const mode of ['allocation', 'processing'] as const) {
    const env = canvasEnvironment(mode === 'allocation' ? 1 : 0, mode === 'processing' ? 1 : 0);
    let calls = 0; const failure = new Error('reporting failure');
    try {
      assert.throws(() => joinStripImages([a, b], 512, 64, 40, { mode: 'strict', onFailure() { calls++; throw failure; } }), error => error === failure);
      assert.equal(calls, 1);
    } finally { env.restore(); }
  }
});
