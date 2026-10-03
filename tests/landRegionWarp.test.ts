/**
 * NAT-5 (QA-039, QA-040, vision checker TOP10 #5 / #10): the land fill regions and the rock no longer meet the ground
 * along the tile grid (landRegionWarp.ts, archetypeGroundRegions.ts, landRockRegions.ts). On every land: the outlines'
 * segments are not laid along the tile grid's four directions and no straight grid-direction run is long (the unwarped
 * outline, measured the same way, is), no outline crosses itself or another, the rock covers its tiles and leaves the
 * rest, the warp's slope stays under the bound its comment proves, and the riverside keeps its rock tiles and pebbles.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { MAP_ARCHETYPE_IDS, RIVERSIDE_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { newGameState } from "../src/state/newGame";
import { landGroundOf, type LandGround } from "../src/render/archetypeGroundModel";
import { fillRegions } from "../src/render/archetypeGroundRegions";
import { groundTileAs, rockChunkToken, rockGroundOf, rockRegion } from "../src/render/landRockRegions";
import { groundBoundaryScene } from "../src/render/groundBoundaryScene";
import { ROCK_WARP_SCALE, warpPoint } from "../src/render/landRegionWarp";
import { pointInPolygon } from "../src/render/groundSceneParts";
import type { BoundaryPoint } from "../src/world/boundary/boundaryGeometry";

const NEW_LANDS = MAP_ARCHETYPE_IDS.filter(id => id !== RIVERSIDE_ARCHETYPE_ID);
const groundOf = (archetypeId: string, seed: number): LandGround => {
  const state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId, seed });
  assert.ok(state !== null, archetypeId);
  const ground = landGroundOf(state);
  assert.ok(ground !== null, archetypeId);
  return ground;
};
const linesOf = (ground: LandGround): readonly (readonly BoundaryPoint[])[] =>
  [...fillRegions(ground), rockRegion(ground)].flatMap(region => region.loops.map(loop => loop.smoothed));
/** The fills' lines with the warp's scale 1, the rock's with ROCK_WARP_SCALE. */
const scaledLinesOf = (ground: LandGround) => [
  ...fillRegions(ground).flatMap(region => region.loops.map(loop => ({ line: loop.smoothed, scale: 1 }))),
  ...rockRegion(ground).loops.map(loop => ({ line: loop.smoothed, scale: ROCK_WARP_SCALE })),
];

/** The segment's angle off the nearest tile-grid direction (0, 45, 90, 135 degrees in the tile plane), in degrees. */
const gridError = (a: BoundaryPoint, b: BoundaryPoint): number => {
  const angle = ((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 360) % 45;
  return Math.min(angle, 45 - angle);
};

/** On the map's border line (64 x 64 maps): an outline there runs under the map's edge and stays put (the warp fades). */
const onBorder = (p: BoundaryPoint) => [p.x, p.y].some(value => Math.abs(value + 0.5) < 1e-6 || Math.abs(value - 63.5) < 1e-6);

/** Of all the lines' length off the border: the share within 1 degree of a grid direction, and the longest straight grid-direction run. */
function alignment(lines: readonly (readonly BoundaryPoint[])[]): { readonly share: number; readonly longest: number } {
  let aligned = 0; let total = 0; let longest = 0;
  for (const line of lines) {
    let run = 0; let runAngle = NaN;
    for (let index = 0; index < line.length; index += 1) {
      const a = line[index]!; const b = line[(index + 1) % line.length]!;
      if (onBorder(a) && onBorder(b)) { run = 0; runAngle = NaN; continue; }
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      total += length;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      if (gridError(a, b) < 1) {
        aligned += length;
        run = Math.abs(angle - runAngle) < (1 * Math.PI) / 180 ? run + length : length;
        runAngle = angle;
      } else { run = 0; runAngle = NaN; }
      longest = Math.max(longest, run);
    }
  }
  return { share: aligned / total, longest };
}

/** The tile-plane point the land's warp takes to `point` (fixed-point iteration: the warp's offset changes slowly). */
const unwarp = (ground: LandGround, point: BoundaryPoint, scale: number): BoundaryPoint => {
  let x = point;
  for (let step = 0; step < 40; step += 1) { const w = warpPoint({ seed: ground.seed, width: ground.width, height: ground.height, scale }, x); x = { x: point.x - (w.x - x.x), y: point.y - (w.y - x.y) }; }
  return x;
};

test("NAT-5: the land and rock outlines leave the tile grid: little length along its directions, no long straight run", () => {
  for (const id of NEW_LANDS) for (const seed of [1, 2]) {
    const ground = groundOf(id, seed);
    const after = alignment(linesOf(ground));
    // The same outlines before the warp (the outline before NAT-5): the measure tells them apart.
    const before = alignment(scaledLinesOf(ground).map(({ line, scale }) => line.map(point => unwarp(ground, point, scale))));
    assert.ok(before.share > 0.5 && before.longest >= 4, `${id} ${seed} before: ${JSON.stringify(before)}`);
    assert.ok(after.share < 0.15, `${id} ${seed} share along the grid ${after.share.toFixed(3)} (before ${before.share.toFixed(3)})`);
    assert.ok(after.longest < 2.5, `${id} ${seed} longest straight grid run ${after.longest.toFixed(2)} tiles (before ${before.longest.toFixed(2)})`);
  }
});

test("NAT-5: QA-040's forest floor, QA-039's chalk and the vision checker's fen edge are no longer grid lines (seed 1, the QA map)", () => {
  for (const [id, base] of [["core:forest_edge", "woodland_floor"], ["core:fen_drainage", "fen"], ["core:chalk_downs", "chalk_down"]] as const) {
    const ground = groundOf(id, 1);
    const region = fillRegions(ground).find(entry => entry.base === base);
    assert.ok(region !== undefined && region.loops.length > 0, `${id} ${base}`);
    const { share, longest } = alignment(region.loops.map(loop => loop.smoothed));
    assert.ok(share < 0.15 && longest < 2.5, `${id} ${base}: ${share.toFixed(3)} ${longest.toFixed(2)}`);
  }
  const chalk = groundOf("core:chalk_downs", 1);
  const rock = alignment(rockRegion(chalk).loops.map(loop => loop.smoothed));
  // The rock takes ROCK_WARP_SCALE of the warp: a little more of it stays near the grid's directions.
  assert.ok(rock.share < 0.25 && rock.longest < 2.5, `chalk rock: ${JSON.stringify(rock)}`);
});

/** Proper crossings between the segments of all lines (shared segments and shared endpoints are not crossings). */
function crossings(lines: readonly (readonly BoundaryPoint[])[]): number {
  type Segment = { a: BoundaryPoint; b: BoundaryPoint };
  const cells = new Map<number, Segment[]>();
  const segments: Segment[] = [];
  for (const line of lines) for (let index = 0; index < line.length; index += 1) {
    const segment = { a: line[index]!, b: line[(index + 1) % line.length]! };
    segments.push(segment);
    for (let y = Math.floor(Math.min(segment.a.y, segment.b.y)); y <= Math.floor(Math.max(segment.a.y, segment.b.y)); y += 1) {
      for (let x = Math.floor(Math.min(segment.a.x, segment.b.x)); x <= Math.floor(Math.max(segment.a.x, segment.b.x)); x += 1) {
        const key = (y + 8) * 1024 + x + 8;
        const list = cells.get(key); if (list === undefined) cells.set(key, [segment]); else list.push(segment);
      }
    }
  }
  const same = (p: BoundaryPoint, q: BoundaryPoint) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;
  const cross = (o: BoundaryPoint, p: BoundaryPoint, q: BoundaryPoint) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const seen = new Set<string>(); let found = 0;
  for (const list of cells.values()) for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
    const s = list[i]!; const t = list[j]!;
    if (same(s.a, t.a) || same(s.a, t.b) || same(s.b, t.a) || same(s.b, t.b)) continue;
    const d1 = cross(s.a, s.b, t.a); const d2 = cross(s.a, s.b, t.b); const d3 = cross(t.a, t.b, s.a); const d4 = cross(t.a, t.b, s.b);
    if (d1 * d2 < 0 && d3 * d4 < 0) {
      const key = [segments.indexOf(s), segments.indexOf(t)].sort().join(":");
      if (!seen.has(key)) { seen.add(key); found += 1; }
    }
  }
  return found;
}

test("NAT-5: the warp folds nothing: no outline crosses itself or another (five lands, seeds 1-4)", () => {
  for (const id of NEW_LANDS) for (const seed of [1, 2, 3, 4]) {
    const ground = groundOf(id, seed);
    for (const region of fillRegions(ground)) assert.equal(crossings(region.loops.map(loop => loop.smoothed)), 0, `${id} ${seed} ${region.base}`);
    assert.equal(crossings(rockRegion(ground).loops.map(loop => loop.smoothed)), 0, `${id} ${seed} rock`);
  }
});

test("NAT-5: the warp folds nothing (its Jacobian determinant stays positive, border fade included) and leaves the border line", () => {
  let minDet = Infinity; let worst = 0; const step = 1e-3;
  for (let seed = 1; seed <= 20; seed += 1) for (let y = -0.5; y < 63.5; y += 0.41) for (let x = -0.5; x < 63.5; x += 0.41) {
    const p = warpPoint({ seed: seed, width: 64, height: 64, scale: 1 }, { x, y });
    const px = warpPoint({ seed: seed, width: 64, height: 64, scale: 1 }, { x: x + step, y }); const py = warpPoint({ seed: seed, width: 64, height: 64, scale: 1 }, { x, y: y + step });
    const a = (px.x - p.x) / step; const b = (px.y - p.y) / step; const c = (py.x - p.x) / step; const d = (py.y - p.y) / step;
    minDet = Math.min(minDet, a * d - b * c);
    worst = Math.max(worst, Math.abs(a - 1), Math.abs(b), Math.abs(c), Math.abs(d - 1));
  }
  assert.ok(minDet > 0.25, `min det ${minDet}`);
  assert.ok(worst < 0.7, `worst partial ${worst}`);
  for (const seed of [1, 7, 99]) for (const point of [{ x: -0.5, y: 20.3 }, { x: 31.7, y: -0.5 }, { x: 63.5, y: 5 }, { x: 12, y: 63.5 }]) {
    assert.deepEqual(warpPoint({ seed: seed, width: 64, height: 64, scale: 1 }, point), point);
  }
  // Away from the border it moves points (by up to about two tiles).
  const moved = Array.from({ length: 50 }, (_, k) => { const p = { x: 10 + k * 0.83, y: 30 + (k % 7) }; const w = warpPoint({ seed: 1, width: 64, height: 64, scale: 1 }, p); return Math.hypot(w.x - p.x, w.y - p.y); });
  assert.ok(Math.max(...moved) > 0.5 && Math.max(...moved) < 2.5, JSON.stringify(moved.map(value => value.toFixed(2))));
});

test("NAT-5 / LU-D5: the warp is pinned at drained cells, so the fen's outline keeps meeting the drain strip on their tile edges", () => {
  const state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: "core:fen_drainage", seed: 1 })!;
  const before = landGroundOf(state)!;
  const fen = before.keys.indexOf("terrain/fen");
  // A fen cell with fen all round: drained, it is a hole in the fen.
  const cell = before.fill.findIndex((value, index) => {
    const tx = index % before.width; const ty = Math.floor(index / before.width);
    return value === fen && tx > 4 && ty > 4 && tx < before.width - 5 && ty < before.height - 5
      && [-1, 0, 1].every(dy => [-1, 0, 1].every(dx => before.fill[(ty + dy) * before.width + tx + dx] === fen));
  });
  assert.ok(cell >= 0);
  const ground = landGroundOf({ ...state, tiles: [...state.tiles], drainage: { works: [], drained: [cell] } })!;
  const tx = cell % ground.width; const ty = Math.floor(cell / ground.width);
  const hole = fillRegions(ground).find(region => region.base === "fen")!.loops
    .find(loop => loop.smoothed.every(point => Math.abs(point.x - tx) <= 0.5 + 1e-9 && Math.abs(point.y - ty) <= 0.5 + 1e-9));
  assert.ok(hole !== undefined, "the drained cell's outline lies on its own tile, unwarped");
  // Away from it the fen's outline is warped as before.
  const far = fillRegions(before).find(region => region.base === "fen")!.loops.map(loop => loop.hash);
  const near = fillRegions(ground).find(region => region.base === "fen")!.loops.map(loop => loop.hash);
  assert.ok(far.some(hash => near.includes(hash)), "loops far from the drain keep their hash");
});

test("NAT-5: the rock region covers the rock tiles and leaves the rest (tile centres one tile from any change)", () => {
  for (const id of NEW_LANDS) {
    const ground = groundOf(id, 1);
    const loops = rockRegion(ground).loops;
    let checked = 0;
    for (let ty = 1; ty < ground.height - 1; ty += 1) for (let tx = 1; tx < ground.width - 1; tx += 1) {
      const block = [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => ground.rock[(ty + dy) * ground.width + tx + dx]));
      if (!block.every(value => value === block[0])) continue;
      const enclosing = loops.filter(loop => pointInPolygon({ x: tx, y: ty }, loop.smoothed)).length;
      assert.equal(enclosing % 2 === 1, block[0] === 1, `${id} at ${tx},${ty}`);
      checked += block[0] === 1 ? 1 : 0;
    }
    if (id === "core:chalk_downs") assert.ok(checked > 20, `${checked} inner rock tiles`);
  }
});

test("NAT-5 / N5-D1: the riverside's rock is the same smoothed region (it has no land layer); every land lays rock as ground and draws no pebbles", () => {
  const rock = { tx: 3, ty: 4, terrain: "rock" } as Parameters<typeof groundTileAs>[0];
  assert.equal(groundTileAs(rock).terrain, "grass");
  assert.equal(groundTileAs({ ...rock, terrain: "forest" }).terrain, "grass");
  const riverside = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 1 })!;
  assert.equal(landGroundOf(riverside), null, "LU-D2: still no land layer");
  const ground = rockGroundOf(riverside);
  assert.equal(ground.rock.filter(value => value === 1).length, riverside.tiles.filter(tile => tile.terrain === "rock").length);
  const region = rockRegion(ground);
  assert.ok(region.loops.length > 0);
  const { share, longest } = alignment(region.loops.map(loop => loop.smoothed));
  assert.ok(share < 0.25 && longest < 2.5, `riverside rock: ${share.toFixed(3)} ${longest.toFixed(2)}`);
  assert.equal(crossings(region.loops.map(loop => loop.smoothed)), 0);
  // Cached on the tiles, and reused for a new tiles array with the same rock (a road, a building).
  assert.equal(rockGroundOf(riverside), ground);
  assert.equal(rockGroundOf({ ...riverside, tiles: riverside.tiles.map(tile => ({ ...tile })) }), ground);
  // A chunk the rock does not reach gains nothing in its content key; one it reaches gains its loops.
  const scene = groundBoundaryScene(riverside);
  const tokens = scene.chunks.map(plan => rockChunkToken(ground, plan));
  assert.ok(tokens.some(token => token === "") && tokens.some(token => token.startsWith("|R")));
  // A new land's rock lives on its land layer.
  const downs = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: "core:chalk_downs", seed: 1 })!;
  assert.equal(rockGroundOf(downs), landGroundOf(downs));
  const source = readFileSync(new URL("../src/render/drawTerrainBoundaryV2.ts", import.meta.url), "utf8");
  assert.ok(!source.includes("drawTerrainTransitions"), "no pebble seam marks on the V2 ground");
  assert.match(source, /\n  drawLandRock\(context, rockGroundOf\(input\.state\), plan, box, input\.terrainPatterns\);/);
  assert.match(source, /\+ rockChunkToken\(rockGroundOf\(input\.state\), plan\)/);
});
