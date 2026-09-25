import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { buildGroundBoundaryScene } from "../src/render/groundBoundaryScene";
import { distanceToSegment, type BoundaryPoint } from "../src/world/boundary/boundaryGeometry";
import { MAJOR_ARM, WALL_LOCK_FULL, wallBaselines, unitEdgeKey } from "../src/world/boundary/wallBaseline";
import { wallGatePoints } from "../src/world/wallTraversal";
import { seedGroundState } from "../scripts/boundaryFixtureStates";

// D3b wall baselines. Logic states only (fixtures and the C1e real-input natural chain); the wall logic is read.
const gz = (path: string): GameState => {
  const raw = JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))).toString("utf8")) as GameState & { state?: GameState };
  return raw.state ?? raw;
};
const scenes = (): readonly [string, GameState][] => [
  ...([1, 2, 3, 4, 5] as const).map(seed => [`seed${seed}`, seedGroundState(seed)] as [string, GameState]),
  ["natural timber", gz("./fixtures/boundary/seed2-arable-scene.json.gz")],
  ["timber partly built", gz("../fixtures/construction-reserve/seed2-113040.json.gz")],
];

test("Given every wall When its baseline is smoothed Then every sample stays within 0.35 tile of the logic edge path and only completed segments are drawn", () => {
  for (const [name, state] of scenes()) {
    const walls = wallBaselines(state.palisade, state);
    assert.ok(walls.chains.length > 0, `${name}: chains`);
    const completed = new Set<string>();
    for (const segment of state.palisade?.segments ?? []) {
      if (!segment.completed) continue;
      for (let index = 1; index < segment.edgePath.length; index += 1) {
        const a = segment.edgePath[index - 1]!; const b = segment.edgePath[index]!;
        const steps = Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)));
        for (let step = 0; step < steps; step += 1) completed.add(unitEdgeKey(
          { x: a.x + (b.x - a.x) * step / steps, y: a.y + (b.y - a.y) * step / steps },
          { x: a.x + (b.x - a.x) * (step + 1) / steps, y: a.y + (b.y - a.y) * (step + 1) / steps }));
      }
    }
    let max = 0;
    for (const chain of walls.chains) {
      for (const key of chain.edges.keys()) assert.ok(completed.has(key), `${name}: ${key} is not a completed edge`);
      for (const sample of chain.samples) {
        let distance = Infinity;
        for (let index = 1; index < chain.raw.length; index += 1) distance = Math.min(distance, distanceToSegment(sample.point, chain.raw[index - 1]!, chain.raw[index]!));
        max = Math.max(max, distance);
      }
    }
    assert.ok(max <= 0.35, `${name}: baseline ${max.toFixed(3)} tile off the edge path`);
    const drawn = walls.chains.reduce((sum, chain) => sum + chain.edges.size, 0);
    assert.equal(drawn, completed.size, `${name}: every completed unit edge drawn once`);
  }
});

test("Given the gates When the baseline reaches them Then it lies on the logic path within 0.15 tile and runs along it within 5 degrees", () => {
  let gates = 0;
  for (const [name, state] of scenes()) {
    const walls = wallBaselines(state.palisade, state);
    for (const gate of state.palisade === null ? [] : wallGatePoints(state.palisade)) {
      for (const chain of walls.chains) {
        const at = [chain.raw[0]!, chain.raw[chain.raw.length - 1]!].findIndex(end => end.x === gate.x && end.y === gate.y);
        if (at < 0) continue;
        gates += 1;
        const length = chain.raw.length - 1;
        const near = chain.samples.filter(sample => (at === 0 ? sample.t : length - sample.t) <= WALL_LOCK_FULL);
        const rawDirection = at === 0 ? { x: chain.raw[1]!.x - gate.x, y: chain.raw[1]!.y - gate.y } : { x: chain.raw[length - 1]!.x - gate.x, y: chain.raw[length - 1]!.y - gate.y };
        for (let index = 0; index < near.length; index += 1) {
          const sample = near[index]!;
          const onPath = distanceToSegment(sample.point, gate, { x: gate.x + rawDirection.x, y: gate.y + rawDirection.y });
          assert.ok(onPath <= 0.15, `${name}: ${onPath.toFixed(3)} tile off the gate run`);
          const next = near[index + 1];
          if (next === undefined) continue;
          const dx = next.point.x - sample.point.x; const dy = next.point.y - sample.point.y;
          if (Math.hypot(dx, dy) < 1e-9) continue;
          const angle = Math.abs(Math.atan2(dx * rawDirection.y - dy * rawDirection.x, dx * rawDirection.x + dy * rawDirection.y)) * 180 / Math.PI;
          assert.ok(Math.min(angle, 180 - angle) <= 5, `${name}: tangent ${angle.toFixed(2)} degrees off the gate run`);
        }
      }
    }
  }
  assert.ok(gates >= 10, `gate ends checked: ${gates}`);
});

test("Given the wall graph When modules are placed Then they stand on logic vertices: towers only where both straight arms are long", () => {
  for (const [name, state] of scenes()) {
    const walls = wallBaselines(state.palisade, state);
    const vertices = new Set(walls.chains.flatMap(chain => chain.raw.map(point => `${point.x},${point.y}`)));
    for (const node of walls.nodes) assert.ok(vertices.has(`${node.point.x},${node.point.y}`), `${name}: module off the wall`);
    const gatePoints = new Set(state.palisade === null ? [] : wallGatePoints(state.palisade).map(point => `${point.x},${point.y}`));
    for (const node of walls.nodes) if (node.kind === "gate") assert.ok(gatePoints.has(`${node.point.x},${node.point.y}`));
    for (const node of walls.nodes.filter(candidate => candidate.kind === "tower")) {
      assert.equal(node.neighbors.length, 2);
      // Both arms are straight for MAJOR_ARM unit edges.
      for (const neighbor of node.neighbors) {
        const dx = neighbor.x - node.point.x; const dy = neighbor.y - node.point.y;
        for (let step = 1; step <= MAJOR_ARM; step += 1) {
          const a = { x: node.point.x + dx * (step - 1), y: node.point.y + dy * (step - 1) }; const b = { x: node.point.x + dx * step, y: node.point.y + dy * step };
          assert.ok(walls.chains.some(chain => chain.edges.has(unitEdgeKey(a, b))), `${name}: tower arm ${step}`);
        }
      }
    }
  }
});

test("Given segments and tiles in another order When baselines are derived Then they are identical", () => {
  for (const [, state] of scenes()) {
    if (state.palisade === null) continue;
    const reordered = { ...state, palisade: { ...state.palisade, segments: [...state.palisade.segments].reverse() }, tiles: [...state.tiles].reverse() };
    assert.deepEqual(wallBaselines(reordered.palisade, reordered), wallBaselines(state.palisade, state));
  }
});

test("Given a wall standing on the lake When the shoreline is derived Then it shares the wall's baseline there and marks it walled", () => {
  for (const [name, state] of scenes().slice(0, 5)) {
    const scene = buildGroundBoundaryScene(state);
    const walls = wallBaselines(state.palisade, state);
    const waterSide = walls.chains.flatMap(chain => chain.samples.filter(sample => sample.water).map(sample => ({ x: sample.point.x - 0.5, y: sample.point.y - 0.5 })));
    const walled = scene.shore.loops.flatMap(loop => loop.smoothed.filter((_, index) => loop.walled[index] === true));
    if (waterSide.length === 0) continue;
    assert.ok(walled.length > 0, `${name}: the shore meets the wall`);
    for (const point of walled) {
      let distance = Infinity;
      for (const chain of walls.chains) for (let index = 1; index < chain.samples.length; index += 1) {
        const a = chain.samples[index - 1]!.point; const b = chain.samples[index]!.point;
        distance = Math.min(distance, distanceToSegment(point, { x: a.x - 0.5, y: a.y - 0.5 } as BoundaryPoint, { x: b.x - 0.5, y: b.y - 0.5 } as BoundaryPoint));
      }
      assert.ok(distance < 1e-6, `${name}: walled shore point ${distance} off the wall`);
    }
  }
});
