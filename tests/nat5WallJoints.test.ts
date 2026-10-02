import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { wallBaselinesFor } from "../src/render/wallBaselineCache";
import { WALL_THICKNESS } from "../src/render/drawWallFaces";
import { chainSides, wallChainJoints } from "../src/render/wallFaceJoints";
import type { BoundaryPoint } from "../src/world/boundary/boundaryGeometry";
import type { WallChain } from "../src/world/boundary/wallBaseline";

// NAT-5 wall corners: the band's side lines are mitred at every bend and joined where two chains meet (wallFaceJoints).
const load = (path: string): GameState => {
  const raw = readFileSync(new URL(path, import.meta.url));
  return decodeSave(new Uint8Array(path.endsWith(".gz") ? gunzipSync(raw) : raw)).envelope.state as GameState;
};
const TOWNS: readonly [string, string][] = [["timber ring (chapter three)", "../fixtures/saves/v41/chapter-three-town.save.json"],
  ["stone ring (chapter four)", "../fixtures/saves/v41/chapter-four-town.save.json"], ["1380 town", "../fixtures/perf-gate/ch4-1380.save.json.gz"]];
const near = (a: BoundaryPoint, b: BoundaryPoint, tolerance = 1e-9): boolean => Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
const endPoint = (chain: WallChain, atEnd: boolean) => chain.raw[atEnd ? chain.raw.length - 1 : 0] as BoundaryPoint;

test("Given the towns' rings When the chain ends are joined Then towers join their two arms, gates and ends stay square", () => {
  for (const [name, path] of TOWNS) {
    // Given
    const { walls } = wallBaselinesFor(load(path));

    // When
    const joints = wallChainJoints(walls);

    // Then
    for (const chain of walls.chains) for (const atEnd of [false, true]) {
      const kind = atEnd ? chain.endKind : chain.startKind;
      const joint = joints.get(chain)?.[atEnd ? "end" : "start"] ?? null;
      if (kind === "gate" || kind === "terminal" || kind === "junction") assert.equal(joint, null, `${name}: a ${kind} end stays square`);
      if (kind === "tower") assert.notEqual(joint, null, `${name}: a tower at ${JSON.stringify(endPoint(chain, atEnd))} joins its arms`);
    }
  }
});

test("Given a tower corner When both arms' side lines are laid Then they meet at the same two corner points, the outer one half a thickness out on both axes", () => {
  for (const [name, path] of TOWNS) {
    const { walls } = wallBaselinesFor(load(path));
    const joints = wallChainJoints(walls);
    for (const node of walls.nodes.filter(entry => entry.kind === "tower")) {
      // Given
      const arms = walls.chains.flatMap(chain => [false, true].filter(atEnd => near(endPoint(chain, atEnd), node.point)).map(atEnd => ({ chain, atEnd })));
      assert.equal(arms.length, 2, `${name}: two arms at the tower ${JSON.stringify(node.point)}`);

      // When
      const corners = arms.map(({ chain, atEnd }) => {
        const half = WALL_THICKNESS[chain.material] / 2;
        const sides = chainSides(chain, joints.get(chain) ?? { start: null, end: null }, half, chain.material);
        const index = atEnd ? chain.samples.length - 1 : 0;
        return { half, points: [sides.left[index] as BoundaryPoint, sides.right[index] as BoundaryPoint] };
      });

      // Then
      const [first, second] = corners as [typeof corners[number], typeof corners[number]];
      for (const point of first.points) assert.ok(second.points.some(other => near(point, other, 1e-6)), `${name}: the arms share ${JSON.stringify(point)}`);
      if (node.neighbors.every(neighbour => neighbour.x === node.point.x || neighbour.y === node.point.y)) {
        for (const point of first.points) {
          assert.ok(Math.abs(Math.abs(point.x - node.point.x) - first.half) < 1e-6 && Math.abs(Math.abs(point.y - node.point.y) - first.half) < 1e-6,
            `${name}: a right-angle corner point lies half a thickness out on both axes (${JSON.stringify(point)} at ${JSON.stringify(node.point)})`);
        }
      }
    }
  }
});

test("Given joined chain ends When the inner side stops on the corner Then no side point runs past it, and every side point stays near the baseline", () => {
  for (const [name, path] of TOWNS) {
    const { walls } = wallBaselinesFor(load(path));
    const joints = wallChainJoints(walls);
    for (const chain of walls.chains) {
      // Given
      const half = WALL_THICKNESS[chain.material] / 2;
      const ends = joints.get(chain) ?? { start: null, end: null };

      // When
      const sides = chainSides(chain, ends, half, chain.material);

      // Then
      for (const line of [sides.left, sides.right]) {
        line.forEach((point, index) => {
          const base = (chain.samples[index] as { point: BoundaryPoint }).point;
          assert.ok(Math.hypot(point.x - base.x, point.y - base.y) <= half * 2 + 1e-9, `${name}: side point ${index} within the mitre limit`);
        });
        const count = line.length;
        if (ends.end !== null) {
          const last = chain.samples[count - 1]!.point; const before = chain.samples[count - 2]!.point;
          const direction = { x: last.x - before.x, y: last.y - before.y };
          const corner = line[count - 1] as BoundaryPoint;
          for (const point of line.slice(0, -1)) assert.ok((point.x - corner.x) * direction.x + (point.y - corner.y) * direction.y <= 1e-9, `${name}: nothing past the end corner`);
        }
      }
    }
  }
});

test("Given the towns' rings When the face and end-on runs are read Then no short run of one kind interrupts the other", () => {
  for (const [name, path] of TOWNS) {
    const { walls } = wallBaselinesFor(load(path));
    const joints = wallChainJoints(walls);
    for (const chain of walls.chains) {
      // Given / When
      const { faceRun } = chainSides(chain, joints.get(chain) ?? { start: null, end: null }, 0.1, chain.material);

      // Then
      assert.equal(faceRun.length, chain.samples.length - 1);
      let start = 0;
      while (start < faceRun.length) {
        let end = start; let arc = 0;
        while (end < faceRun.length && faceRun[end] === faceRun[start]) {
          const a = chain.samples[end]!.point; const b = chain.samples[end + 1]!.point;
          arc += Math.hypot(b.x - a.x, b.y - a.y); end += 1;
        }
        if (start > 0 && end < faceRun.length) assert.ok(arc >= 0.35, `${name}: a ${faceRun[start] ? "face" : "end-on"} run of ${arc.toFixed(2)} tiles inside the chain`);
        start = end;
      }
    }
  }
});
