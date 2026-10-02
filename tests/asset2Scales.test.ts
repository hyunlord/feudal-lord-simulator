import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PASTURE_COW_LENGTH_PX, WAVE13_ANIMAL_SCALE } from "../src/render/animalScale";
import { decodePng } from "../scripts/keyartDerivatives";
import { STORY_WALKER_FIGURE_HEIGHT, storyWalkerScale, type StoryWalkerKey } from "../src/render/storyWorldProps";
import { WALKER_FIGURE_PX } from "../src/render/walkerComposer";
import { WAVE9_IMAGES } from "../src/render/wave9ArtManifest.generated";

// ASSET-2 ⑥: the Wave 13 animals' install scale (MOVE-2) — a cow, an ox and a draught horse at WAVE13_ANIMAL_SCALE are
// as long as the pasture's installed cow, ± 10 %; the small animals keep their drawn proportion to them.
/** The widest separate figure's opaque width (alpha > 64): 4-connected components, flood-filled. */
function bodyLength(path: string): number {
  const { width, height, data } = decodePng(new Uint8Array(readFileSync(path)));
  const seen = new Uint8Array(width * height);
  let widest = 0;
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] === 1 || data[start * 4 + 3]! <= 64) continue;
    let min = width; let max = -1; const stack = [start]; seen[start] = 1;
    while (stack.length > 0) {
      const at = stack.pop()!; const x = at % width;
      min = Math.min(min, x); max = Math.max(max, x);
      for (const next of [at - 1, at + 1, at - width, at + width]) {
        if (next < 0 || next >= width * height || seen[next] === 1 || data[next * 4 + 3]! <= 64) continue;
        if ((next === at - 1 && x === 0) || (next === at + 1 && x === width - 1)) continue;
        seen[next] = 1; stack.push(next);
      }
    }
    widest = Math.max(widest, max - min + 1);
  }
  return widest;
}
const wave13 = (name: string) => `assets-inbox/wave13/candidates-v1/assets/animal_walk/${name}-v1.png`;

test("ASSET-2 the Wave 13 cow, ox and draught horse at the batch's scale are the pasture cow's length ± 10 %", () => {
  const cow = bodyLength("public/assets/zones/animals/cattle_pair-v1.png") * (30 / 128);
  assert.ok(Math.abs(cow - PASTURE_COW_LENGTH_PX) < 0.5, `the installed cow: ${cow.toFixed(1)} px`);
  for (const name of ["cow_single", "ox", "horse_draught"]) {
    const length = bodyLength(wave13(name)) * WAVE13_ANIMAL_SCALE;
    assert.ok(Math.abs(length / cow - 1) <= 0.1, `${name}: ${length.toFixed(1)} px against the pasture cow's ${cow.toFixed(1)}`);
  }
  // The small ones in the proportion Astra drew them: a sheep about half a cow, a goose under a third.
  const sheep = bodyLength(wave13("sheep_single")) * WAVE13_ANIMAL_SCALE;
  const goose = bodyLength(wave13("goose_single")) * WAVE13_ANIMAL_SCALE;
  assert.ok(sheep / cow > 0.35 && sheep / cow < 0.65, `sheep ${sheep.toFixed(1)}`);
  assert.ok(goose / cow < 0.35, `goose ${goose.toFixed(1)}`);
});

/** The median opaque height (alpha > 32) of a 4 × 2 walker sheet's cells. */
function figureHeight(path: string): number {
  const { width, height, data } = decodePng(new Uint8Array(readFileSync(path)));
  const cellWidth = width / 4; const cellHeight = height / 2; const heights: number[] = [];
  for (let row = 0; row < 2; row += 1) for (let column = 0; column < 4; column += 1) {
    let top = cellHeight; let bottom = -1;
    for (let y = 0; y < cellHeight; y += 1) for (let x = 0; x < cellWidth; x += 1) {
      if (data[(((row * cellHeight + y) * width) + column * cellWidth + x) * 4 + 3]! > 32) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
    if (bottom >= top) heights.push(bottom - top + 1);
  }
  return heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)]!;
}

test("ASSET-2 the Wave 9 story walkers are drawn as tall as an ordinary walker (the composer's 16 px, NAT-4 BLD-07), ± 10 %", () => {
  assert.ok(Math.abs(WALKER_FIGURE_PX - 16) < 1e-9);
  for (const key of Object.keys(STORY_WALKER_FIGURE_HEIGHT) as StoryWalkerKey[]) {
    const measured = figureHeight(`public/${WAVE9_IMAGES[key].url}`);
    assert.ok(Math.abs(measured - STORY_WALKER_FIGURE_HEIGHT[key]) <= 1, `${key}: measured ${measured}, recorded ${STORY_WALKER_FIGURE_HEIGHT[key]}`);
    const drawn = measured * storyWalkerScale(key);
    assert.ok(Math.abs(drawn / WALKER_FIGURE_PX - 1) <= 0.1, `${key}: ${drawn.toFixed(1)} px`);
  }
});
