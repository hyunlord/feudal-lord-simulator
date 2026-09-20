import assert from "node:assert/strict";
import test from "node:test";
import { drawMasonrySolid } from "../src/render/stoneWallMasonry";
import type { StoneWallSolid } from "../src/render/stoneWallFallbackGeometry";
import type { RasterizedWorldSprite } from "../src/render/worldSpriteRaster";

function recorder() {
  const paths: number[][][] = [];
  const transforms: number[][] = [];
  const blits: number[][] = [];
  let path: number[][] = [];
  let clips = 0;
  const context = {
    globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1, imageSmoothingEnabled: false,
    save() {}, restore() {}, beginPath() { path = []; }, closePath() {},
    moveTo(x: number, y: number) { path.push([x, y]); },
    lineTo(x: number, y: number) { path.push([x, y]); },
    fill() { paths.push(path.map(point => [...point])); }, stroke() {},
    clip() { clips += 1; }, transform(...values: number[]) { transforms.push(values); },
    getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
    drawImage(_image: CanvasImageSource, ...values: number[]) { blits.push(values); },
  };
  return { context: context as unknown as CanvasRenderingContext2D, paths, transforms, blits, clips: () => clips };
}
const solid: StoneWallSolid = {
  footprint: [{ x: 1, y: 1 }, { x: 21, y: 11 }, { x: 19, y: 12 }, { x: -1, y: 2 }],
  base: 14, height: 4,
};
const material: RasterizedWorldSprite = {
  image: {} as CanvasImageSource, source: { x: 0, y: 0, width: 60, height: 180 },
};

test("missing wall material preserves all four side faces and the existing raised cap", () => {
  const output = recorder();
  drawMasonrySolid(output.context, solid, null, true);
  assert.equal(output.paths.length, 5);
  assert.deepEqual(output.paths[4], solid.footprint.map(point => [point.x, point.y - 18]));
  assert.equal(output.blits.length, 0);
  assert.equal(output.context.globalAlpha, 1);
});

test("wall material stays clipped and leaves the solid geometry intact", () => {
  const plain = recorder(); const textured = recorder();
  drawMasonrySolid(plain.context, solid, null, true);
  drawMasonrySolid(textured.context, solid, material, true);
  for (const path of plain.paths) assert.ok(textured.paths.some(other => JSON.stringify(other) === JSON.stringify(path)));
  assert.ok(textured.clips() >= 4);
  assert.ok(textured.blits.length > 0);
});

test("textured caps use the ground-plane projection instead of stretching a vertical wall face", () => {
  const output = recorder();
  drawMasonrySolid(output.context, solid, material, true);
  assert.ok(output.transforms.some(values => values[0] === 1 && values[1] === 0.5 && values[2] === -1 && values[3] === 0.5));
  assert.ok(output.blits.some(values => values[2] === 60 && values[3] === 60));
});

test("neighboring raised wall faces keep a shared world material phase", () => {
  const output = recorder();
  drawMasonrySolid(output.context, solid, material, true);
  const sides = output.blits.filter(values => values[3] === 180);
  assert.ok(sides.length > 0);
  assert.ok(sides.every(values => Math.abs((values[4] ?? 0) % 3) < 1e-9 && Math.abs((values[5] ?? 0) % 9) < 1e-9));
  assert.ok(sides.some(values => (values[5] ?? 0) < -solid.base));
});

test("a translated continuation of a face uses the same texture plane", () => {
  const first = recorder(); const next = recorder();
  const [a, b, c, d] = solid.footprint;
  const translate = (point: typeof a) => ({ x: point.x + 20, y: point.y + 10 });
  drawMasonrySolid(first.context, solid, material, true);
  drawMasonrySolid(next.context, { ...solid, footprint: [translate(a), translate(b), translate(c), translate(d)] }, material, true);
  const alongWall = (values: number[]) => Math.abs((values[1] ?? 0) - 1 / Math.sqrt(5)) < 1e-9;
  const firstPlane = first.transforms.find(alongWall); const nextPlane = next.transforms.find(alongWall);
  assert.ok(firstPlane && nextPlane);
  firstPlane.forEach((value, index) => assert.ok(Math.abs(value - (nextPlane[index] ?? Infinity)) < 1e-9));
});
