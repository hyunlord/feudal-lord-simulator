import assert from "node:assert/strict";
import test from "node:test";
import { recordDrawExtent } from "../src/render/rasterDrawBounds";
import { IMAGE_OPAQUE_BOUNDS } from "../src/render/pixelFacts.generated";

// SMOOTH-2R: the recorded extent of a draw callback bounds everything it paints, without reading a pixel.
type Call = readonly [string, readonly unknown[]];
function fakePaint(): { paint: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const state = { lineWidth: 1, lineJoin: "round", miterLimit: 10, imageSmoothingEnabled: false, filter: "none", fillStyle: "#000000" };
  const paint = new Proxy(state as Record<string, unknown>, {
    get(target, property) {
      if (property in target) return target[property as string];
      if (property === "getImageData") return undefined;
      return (...args: unknown[]) => { calls.push([String(property), args]); };
    },
  });
  return { paint: paint as unknown as CanvasRenderingContext2D, calls };
}
const IDENTITY = [1, 0, 0, 1, 0, 0] as const;

test("paths, rectangles and strokes are bounded under the starting transform, save/restore and clips", () => {
  const { paint, calls } = fakePaint();
  const extent = recordDrawExtent(paint, [2, 0, 0, 2, -10, -20], context => {
    context.fillRect(10, 10, 5, 5); // device 10..20, 0..10
    context.save();
    context.translate(100, 0);
    context.beginPath(); context.rect(0, 0, 10, 10); context.clip(); // device clip 190..210, -20..0
    context.fillRect(-50, -50, 200, 200); // clipped to the clip
    context.restore();
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(5, 40); context.lineTo(15, 40); context.stroke(); // device 0..20 at y 60
  });
  assert.ok(extent !== null && extent !== "unbounded");
  // The stroke reaches half its width (1) times a round join's sqrt2 times the scale's norm (2 sqrt2): 4 device px,
  // and every paint an antialiased edge pixel more; the clipped fill stops a pixel past the clip.
  assert.ok(Math.abs(extent.left - (0 - 5)) < 1e-9, String(extent.left));
  assert.equal(extent.right, 210 + 1);
  assert.equal(extent.top, -20 - 1);
  assert.ok(Math.abs(extent.bottom - (60 + 5)) < 1e-9, String(extent.bottom));
  // Every call reached the canvas, in order.
  assert.deepEqual(calls.map(([name]) => name), ["fillRect", "save", "translate", "beginPath", "rect", "clip", "fillRect", "restore", "beginPath", "moveTo", "lineTo", "stroke"]);
});

test("an image counts only its opaque part from the build-time bounds, a smoothed one with its filter's reach", () => {
  const [url, facts] = Object.entries(IMAGE_OPAQUE_BOUNDS).find(([, box]) => box.left > 10 && box.top > 10 && box.right < box.width && box.bottom < box.height)!;
  const image = { src: `http://localhost/${url}`, naturalWidth: facts.width, naturalHeight: facts.height } as unknown as CanvasImageSource;
  const { paint } = fakePaint();
  const extent = recordDrawExtent(paint, IDENTITY, context => { context.drawImage(image, 0, 0, facts.width, facts.height, 0, 0, facts.width, facts.height); });
  assert.deepEqual(extent, { left: facts.left - 2, top: facts.top - 2, right: facts.right + 2, bottom: facts.bottom + 2 });
  paint.imageSmoothingEnabled = true;
  const half = recordDrawExtent(paint, IDENTITY, context => { context.drawImage(image, 0, 0, facts.width / 2, facts.height / 2); });
  assert.deepEqual(half, { left: (facts.left - 1) / 2 - 3, top: (facts.top - 1) / 2 - 3, right: (facts.right + 1) / 2 + 3, bottom: (facts.bottom + 1) / 2 + 3 });
  const unknown = { width: 40, height: 30 } as unknown as CanvasImageSource;
  assert.deepEqual(recordDrawExtent(paint, IDENTITY, context => { context.drawImage(unknown, 5, 5); }), { left: 2, top: 2, right: 48, bottom: 38 });
});

test("calls it cannot bound make the raster count whole, and nothing painted is null", () => {
  const { paint } = fakePaint();
  assert.equal(recordDrawExtent(paint, IDENTITY, context => { context.fillText("x", 0, 0); }), "unbounded");
  assert.equal(recordDrawExtent(paint, IDENTITY, context => { context.fill({} as Path2D); }), "unbounded");
  assert.equal(recordDrawExtent(paint, IDENTITY, context => { context.putImageData({} as ImageData, 0, 0); }), "unbounded");
  assert.equal(recordDrawExtent(paint, IDENTITY, context => { context.beginPath(); context.moveTo(0, 0); context.clearRect(0, 0, 9, 9); }), null);
  paint.filter = "blur(2px)";
  assert.equal(recordDrawExtent(paint, IDENTITY, context => { context.fillRect(0, 0, 1, 1); }), "unbounded");
});
