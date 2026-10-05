import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
const modulePath = '../scripts/artContractCaptures.mjs';
const { initializeCaptureDocument } = await import(modulePath);

function scenario(body: string) {
  return runInNewContext(`
    const calls = [];
    class HTMLImageElement { get src() { return this.url; } set src(value) { this.url = value; } }
    class HTMLCanvasElement {
      get width() { return this.w ?? 64; } set width(v) { this.w = v; }
      get height() { return this.h ?? 64; } set height(v) { this.h = v; }
    }
    class OffscreenCanvas extends HTMLCanvasElement {}
    class CanvasPattern { setTransform(value) { this.transform = value; } }
    class CanvasRenderingContext2D {
      constructor(canvas) { this.canvas = canvas; this.globalAlpha = 1; this.globalCompositeOperation = 'source-over'; this.fillStyle = '#000'; this.strokeStyle = '#000'; }
      createPattern(source, repetition) {
        if (!(this instanceof CanvasRenderingContext2D)) throw new TypeError('receiver');
        calls.push(['createPattern', source, repetition]);
        if (source === 'throw') throw new Error('pattern failed');
        if (source === null) throw new TypeError('invalid image source');
        return source instanceof HTMLImageElement && source.unavailable ? null : new CanvasPattern();
      }
      drawImage(...args) { calls.push(['drawImage', this, ...args]); }
      fill(...args) { return this.paint('fill', args); }
      fillRect(...args) { return this.paint('fillRect', args); }
      stroke(...args) { return this.paint('stroke', args); }
      strokeRect(...args) { return this.paint('strokeRect', args); }
      paint(method, args) { if (this.fail) throw new Error('paint failed'); calls.push([method, this, ...args]); return 'native-result'; }
      clearRect() {}
      getTransform() { return {a:1,b:0,c:0,d:1,e:0,f:0}; }
    }
    class OffscreenCanvasRenderingContext2D extends CanvasRenderingContext2D {}
    const main = new HTMLCanvasElement();
    const document = {querySelector: () => main};
    const location = {protocol:'http:',href:'http://127.0.0.1:4309/'};
    const localStorage = {setItem() {}};
    const window = {};
    (${initializeCaptureDocument.toString()})();
    const image = new HTMLImageElement(); image.src = '/assets/fields/ridge.png';
    const ctx = new CanvasRenderingContext2D(main);
    const scratch = new OffscreenCanvas();
    const off = new OffscreenCanvasRenderingContext2D(scratch);
    const drawn = () => [...window.__ART_CAPTURE__.draws];
    ${body}
  `, { URL });
}

for (const method of ['fill', 'fillRect', 'stroke', 'strokeRect']) test(`pattern lineage on actual ${method} retains native arguments/style/result`, () => {
  const observed = scenario(`
    const pattern = ctx.createPattern(image, 'repeat'); pattern.setTransform({a:2});
    const initial = drawn(); ctx.${method.startsWith('stroke') ? 'strokeStyle' : 'fillStyle'} = pattern;
    const result = ctx.${method}(2, 3, 4, 5);
    const call = calls.find(row => row[0] === '${method}');
    [initial.length, drawn(), result, call[1] === ctx, call.slice(2), pattern.transform.a];
  `);
  assert.deepEqual(JSON.parse(JSON.stringify(observed)), [0, ['/assets/fields/ridge.png'], 'native-result', true, [2, 3, 4, 5], 2]);
});

for (const action of ['unused', 'replaced', 'null', 'create-throws', 'paint-throws', 'alpha-zero', 'erase', 'zero-area']) test(`does not attribute pattern paint when ${action}`, () => {
  const observed = scenario(`
    if ('${action}' === 'null') image.unavailable = true;
    const pattern = ctx.createPattern(image, 'repeat');
    if ('${action}' === 'null' && pattern !== null) throw new Error('expected unavailable image to return null');
    if (pattern !== null) ctx.fillStyle = pattern;
    if ('${action}' === 'replaced') ctx.fillStyle = '#123';
    if ('${action}' === 'alpha-zero') ctx.globalAlpha = 0;
    if ('${action}' === 'erase') ctx.globalCompositeOperation = 'destination-out';
    if ('${action}' === 'paint-throws') ctx.fail = true;
    try {
      if ('${action}' === 'create-throws') ctx.createPattern('throw', 'repeat');
      else if ('${action}' === 'zero-area') ctx.fillRect(0, 0, 0, 10);
      else if ('${action}' !== 'unused') ctx.fillRect(0, 0, 10, 10);
    } catch(error) { if (!['create-throws', 'paint-throws'].includes('${action}')) throw error; }
    drawn();
  `);
  assert.deepEqual(Array.from(observed), []);
});

for (const action of ['paint', 'offscreen-only', 'clear', 'resize']) test(`joined canvas pattern propagates through offscreen chain: ${action}`, () => {
  const observed = scenario(`
    const joined = new HTMLCanvasElement();
    new CanvasRenderingContext2D(joined).drawImage(image, 0, 0);
    off.fillStyle = off.createPattern(joined, 'repeat'); off.fillRect(0,0,64,64);
    const before = drawn();
    if ('${action}' === 'clear') off.clearRect(0,0,64,64);
    if ('${action}' === 'resize') scratch.width = 80;
    if ('${action}' !== 'offscreen-only') ctx.drawImage(scratch,0,0);
    [before.length, drawn()];
  `);
  assert.deepEqual(JSON.parse(JSON.stringify(observed)), [0, action === 'paint' ? ['/assets/fields/ridge.png'] : []]);
});

test('pattern lineage snapshots the source canvas at pattern creation', () => {
  const observed = scenario(`
    off.drawImage(image,0,0); const pattern = ctx.createPattern(scratch,'repeat');
    off.clearRect(0,0,64,64); ctx.fillStyle = pattern; ctx.fillRect(0,0,10,10); drawn();
  `);
  assert.deepEqual(Array.from(observed), ['/assets/fields/ridge.png']);
});


test('zero-width strokeRect can still paint a patterned line', () => {
  const observed = scenario(`
    ctx.strokeStyle = ctx.createPattern(image, 'repeat'); ctx.strokeRect(0,0,0,10); drawn();
  `);
  assert.deepEqual(Array.from(observed), ['/assets/fields/ridge.png']);
});

test('capture wrapper does not add argument coercion to native paint', () => {
  const observed = scenario(`
    ctx.fillStyle = ctx.createPattern(image, 'repeat');
    const width = {valueOf() { throw new Error('unexpected wrapper coercion'); }};
    const result = ctx.fillRect(0,0,width,10);
    const call = calls.find(row => row[0] === 'fillRect');
    [result, call[4] === width];
  `);
  assert.deepEqual(Array.from(observed), ['native-result', true]);
});
