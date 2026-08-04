import assert from "node:assert/strict";
import test from "node:test";

import { fbm, valueNoise2D } from "../src/world/noise";

test("valueNoise2D is deterministic, seed-aware, and bounded", () => {
  const coordinates = [
    { x: 0, y: 0 },
    { x: 0.125, y: 4.75 },
    { x: -3.5, y: 8.25 },
    { x: 128.875, y: -64.125 },
  ] as const;

  const first = coordinates.map(({ x, y }) => valueNoise2D(x, y, 17));
  const second = coordinates.map(({ x, y }) => valueNoise2D(x, y, 17));
  const otherSeed = coordinates.map(({ x, y }) => valueNoise2D(x, y, 18));

  assert.deepEqual(first, second);
  assert.ok(first.every((value) => value >= 0 && value <= 1));
  assert.notDeepEqual(first, otherSeed);
});

test("valueNoise2D remains continuous across lattice boundaries", () => {
  const epsilon = 0.0001;
  const left = valueNoise2D(3 - epsilon, -2.375, 42);
  const right = valueNoise2D(3 + epsilon, -2.375, 42);
  const above = valueNoise2D(7.625, 5 - epsilon, 42);
  const below = valueNoise2D(7.625, 5 + epsilon, 42);

  assert.ok(Math.abs(left - right) < 0.001);
  assert.ok(Math.abs(above - below) < 0.001);
});

test("fbm is deterministic, normalized, and combines coherent octaves", () => {
  const coordinates = Array.from({ length: 64 }, (_, index) => ({
    x: (index % 8) * 0.17 - 0.4,
    y: Math.floor(index / 8) * 0.17 + 1.3,
  }));

  const fourOctaves = coordinates.map(({ x, y }) => fbm(x, y, 91, 4));
  const repeated = coordinates.map(({ x, y }) => fbm(x, y, 91, 4));
  const oneOctave = coordinates.map(({ x, y }) => fbm(x, y, 91, 1));
  const otherSeed = coordinates.map(({ x, y }) => fbm(x, y, 92, 4));

  assert.deepEqual(fourOctaves, repeated);
  assert.ok(fourOctaves.every((value) => value >= 0 && value <= 1));
  assert.notDeepEqual(fourOctaves, oneOctave);
  assert.notDeepEqual(fourOctaves, otherSeed);
});

test("fbm rejects non-positive or fractional octave counts", () => {
  assert.throws(() => fbm(0, 0, 1, 0), /octaves/i);
  assert.throws(() => fbm(0, 0, 1, -1), /octaves/i);
  assert.throws(() => fbm(0, 0, 1, 1.5), /octaves/i);
});
