import assert from "node:assert/strict";
import test from "node:test";
import { roadGroundPolygons } from "../src/render/organicRoadGeometry";
import type { CardinalDirection } from "../src/render/terrainDetails";

const directions: readonly CardinalDirection[] = ["north", "east", "south", "west"];

test("all sixteen road connections stay within the occupied tile", () => {
  // Given / When
  const polygons = Array.from({ length: 16 }, (_, mask) => roadGroundPolygons({
    tx: 10, ty: 12, seed: 73, arms: directions.filter((_, index) => mask & (1 << index)),
  }));
  // Then
  for (const point of polygons.flat(2)) {
    assert.ok(Math.abs(point.tx - 10) <= 0.5);
    assert.ok(Math.abs(point.ty - 12) <= 0.5);
  }
});

test("horizontal and vertical road neighbours meet on exactly matching edges", () => {
  // Given
  for (const [outward, inward, dx, dy] of [["east", "west", 1, 0], ["south", "north", 0, 1]] as const) {
    // When
    const first = roadGroundPolygons({ tx: 4, ty: 7, seed: 19, arms: [outward] }).flat();
    const second = roadGroundPolygons({ tx: 4 + dx, ty: 7 + dy, seed: 19, arms: [inward] }).flat();
    const atEdge = (p: { readonly tx: number; readonly ty: number }): boolean => dx === 1 ? p.tx === 4.5 : p.ty === 7.5;
    const order = (a: { readonly tx: number; readonly ty: number }, b: { readonly tx: number; readonly ty: number }): number => a.tx - b.tx || a.ty - b.ty;
    // Then
    assert.deepEqual(first.filter(atEdge).sort(order), second.filter(atEdge).sort(order));
  }
});

test("road margin variation is stable by seed without moving connection endpoints", () => {
  // Given
  const input = { tx: 2, ty: 3, seed: 91, arms: directions };
  // When / Then
  assert.deepEqual(roadGroundPolygons(input), roadGroundPolygons(input));
  assert.notDeepEqual(roadGroundPolygons(input), roadGroundPolygons({ ...input, seed: 92 }));
});

function signedArea(polygon: readonly { readonly tx: number; readonly ty: number }[]): number {
  return polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return next === undefined ? sum : sum + point.tx * next.ty - next.tx * point.ty;
  }, 0) / 2;
}

function contains(polygon: readonly { readonly tx: number; readonly ty: number }[], tx: number, ty: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if (a !== undefined && b !== undefined && (a.ty > ty) !== (b.ty > ty)
      && tx < (b.tx - a.tx) * (ty - a.ty) / (b.ty - a.ty) + a.tx) inside = !inside;
  }
  return inside;
}

test("Given straight roads When painted Then no repeated oversized centre discs widen their margins", () => {
  for (const arms of [["east", "west"], ["north", "south"]] as const) {
    const polygons = roadGroundPolygons({ tx: 0, ty: 0, seed: 1, arms });
    for (const point of polygons.flat()) {
      assert.ok(Math.abs(arms[0] === "east" ? point.ty : point.tx) <= 0.245);
    }
  }
});

test("Given adjoining road arms When they meet Then their concave corners have a rounded earth fillet", () => {
  for (let i = 0; i < 4; i++) {
    const first = directions[i], second = directions[(i + 1) % 4];
    assert.ok(first !== undefined && second !== undefined);
    const angle = -Math.PI / 4 + i * Math.PI / 2;
    const x = Math.cos(angle) * Math.SQRT2 * 0.255;
    const y = Math.sin(angle) * Math.SQRT2 * 0.255;
    const polygons = roadGroundPolygons({ tx: 0, ty: 0, seed: 1, arms: [first, second] });
    assert.ok(polygons.some(polygon => contains(polygon, x, y)), `${first}/${second} concave corner`);
  }
});

test("Given every mask across seeds and locations When painted Then bounds winding and absent edges stay valid", () => {
  for (const seed of [0, 1, 19, 103]) for (const [tx, ty] of [[0, 0], [7, 8], [63, 63]]) {
    assert.ok(tx !== undefined && ty !== undefined);
    for (let mask = 0; mask < 16; mask++) {
      const arms = directions.filter((_, i) => mask & (1 << i));
      const polygons = roadGroundPolygons({ tx, ty, seed, arms });
      for (const polygon of polygons) {
        assert.ok(signedArea(polygon) > 0, `winding mask=${mask}`);
        for (const point of polygon) {
          assert.ok(Math.abs(point.tx - tx) <= 0.5 && Math.abs(point.ty - ty) <= 0.5);
          if (!(mask & 1)) assert.ok(point.ty > ty - 0.5);
          if (!(mask & 2)) assert.ok(point.tx < tx + 0.5);
          if (!(mask & 4)) assert.ok(point.ty < ty + 0.5);
          if (!(mask & 8)) assert.ok(point.tx > tx - 0.5);
        }
      }
    }
  }
});

test("Given arbitrary connected neighbour masks When roads are rebuilt Then every shared edge matches", () => {
  for (const seed of [0, 1, 71]) for (const [tx, ty] of [[0, 0], [7, 8], [61, 62]] as const) {
    for (const [outward, inward, dx, dy] of [["east", "west", 1, 0], ["south", "north", 0, 1]] as const) {
      for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
        const firstArms = directions.filter((direction, i) => direction === outward || a & (1 << i));
        const secondArms = directions.filter((direction, i) => direction === inward || b & (1 << i));
        const first = roadGroundPolygons({ tx, ty, seed, arms: firstArms }).flat();
        const second = roadGroundPolygons({ tx: tx + dx, ty: ty + dy, seed, arms: secondArms }).flat();
        const edge = (p: { readonly tx: number; readonly ty: number }): boolean => dx === 1 ? p.tx === tx + 0.5 : p.ty === ty + 0.5;
        const order = (p: { readonly tx: number; readonly ty: number }, q: { readonly tx: number; readonly ty: number }): number => p.tx - q.tx || p.ty - q.ty;
        assert.deepEqual(first.filter(edge).sort(order), second.filter(edge).sort(order));
      }
    }
  }
});

test("Given identical roads placed in a different order When rendered Then their geometry is identical", () => {
  const input = { tx: 9, ty: 4, seed: 31, arms: directions };
  assert.deepEqual(roadGroundPolygons(input), roadGroundPolygons({ ...input, arms: [...directions].reverse() }));
});

test("Given road readability cores When every mask is drawn Then they stay inside the ground road", () => {
  for (let mask = 0; mask < 16; mask++) {
    const input = { tx: 7, ty: 8, seed: 13, arms: directions.filter((_, i) => mask & (1 << i)) };
    const ground = roadGroundPolygons(input);
    for (const point of roadGroundPolygons({ ...input, widthScale: 0.45 }).flat()) {
      const tx = 7 + (point.tx - 7) * 0.99999;
      const ty = 8 + (point.ty - 8) * 0.99999;
      assert.ok(ground.some(polygon => contains(polygon, tx, ty)), `mask ${mask}`);
    }
  }
});
