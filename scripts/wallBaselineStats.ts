// D3b gate 2 numbers: every wall baseline's largest distance from the logic edge path, and at every gate end the
// largest offset from the gate run and tangent angle within the lock (same measures as tests/wallFaces.test.ts).
//   npx tsx scripts/wallBaselineStats.ts > docs/verification/d3b-walls/deviation.json
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { distanceToSegment } from "../src/world/boundary/boundaryGeometry";
import { WALL_LOCK_FULL, wallBaselines } from "../src/world/boundary/wallBaseline";
import { wallGatePoints } from "../src/world/wallTraversal";
import { seedGroundState } from "./boundaryFixtureStates";

const gz = (path: string): GameState => { const raw = JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))).toString("utf8")); return raw.state ?? raw; };
const scenes: [string, GameState][] = [...([1, 2, 3, 4, 5] as const).map(seed => [`seed${seed}`, seedGroundState(seed)] as [string, GameState]),
  ["natural timber (C1e real input)", gz("../tests/fixtures/boundary/seed2-arable-scene.json.gz")], ["timber partly built (construction-reserve)", gz("../fixtures/construction-reserve/seed2-113040.json.gz")]];
const rows = scenes.map(([name, state]) => {
  const started = performance.now();
  const walls = wallBaselines(state.palisade, state);
  const ms = performance.now() - started;
  let max = 0;
  for (const chain of walls.chains) for (const sample of chain.samples) {
    let distance = Infinity;
    for (let index = 1; index < chain.raw.length; index += 1) distance = Math.min(distance, distanceToSegment(sample.point, chain.raw[index - 1]!, chain.raw[index]!));
    max = Math.max(max, distance);
  }
  let gateOffset = 0; let gateAngle = 0; let gateEnds = 0;
  for (const gate of state.palisade === null ? [] : wallGatePoints(state.palisade)) for (const chain of walls.chains) {
    const at = [chain.raw[0]!, chain.raw[chain.raw.length - 1]!].findIndex(end => end.x === gate.x && end.y === gate.y);
    if (at < 0) continue;
    gateEnds += 1;
    const length = chain.raw.length - 1;
    const next = at === 0 ? chain.raw[1]! : chain.raw[length - 1]!;
    const dir = { x: next.x - gate.x, y: next.y - gate.y };
    const near = chain.samples.filter(sample => (at === 0 ? sample.t : length - sample.t) <= WALL_LOCK_FULL);
    near.forEach((sample, index) => {
      gateOffset = Math.max(gateOffset, distanceToSegment(sample.point, gate, next));
      const following = near[index + 1];
      if (following === undefined) return;
      const dx = following.point.x - sample.point.x; const dy = following.point.y - sample.point.y;
      if (Math.hypot(dx, dy) < 1e-9) return;
      const angle = Math.abs(Math.atan2(dx * dir.y - dy * dir.x, dx * dir.x + dy * dir.y)) * 180 / Math.PI;
      gateAngle = Math.max(gateAngle, Math.min(angle, 180 - angle));
    });
  }
  const kinds: Record<string, number> = {};
  for (const node of walls.nodes) kinds[node.kind] = (kinds[node.kind] ?? 0) + 1;
  return { scene: name, chains: walls.chains.length, nodes: kinds, pillars: walls.pillars.length, maxDeviationTiles: Number(max.toFixed(4)),
    gateEnds, gateMaxOffsetTiles: Number(gateOffset.toFixed(4)), gateMaxTangentDegrees: Number(gateAngle.toFixed(3)), buildMs: Number(ms.toFixed(1)) };
});
process.stdout.write(`${JSON.stringify({ limit: { deviation: 0.35, gateOffset: 0.15, gateTangentDegrees: 5 }, rows }, null, 2)}\n`);
