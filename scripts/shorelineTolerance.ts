// D3a gate 1 numbers: shoreline distance to the water / land cell edges (every fixture and bridge scene), and at each
// bridge end the contact offset from the bank edge and the outline's angle to it. Same measures as tests/shoreline.test.ts.
//   npx tsx scripts/shorelineTolerance.ts > docs/verification/d3a-shoreline/tolerance.json
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { buildGroundBoundaryScene } from "../src/render/groundBoundaryScene";
import type { BoundaryPoint } from "../src/world/boundary/boundaryGeometry";
import { outlineTolerance } from "../src/world/boundary/boundaryTolerance";
import { seedGroundState } from "./boundaryFixtureStates";

const fixture = (name: string): GameState => JSON.parse(gunzipSync(readFileSync(new URL(`../tests/fixtures/boundary/${name}`, import.meta.url))).toString("utf8")) as GameState;
const scenes: [string, GameState][] = [...([1, 2, 3, 4, 5] as const).map(seed => [`seed${seed}`, seedGroundState(seed)] as [string, GameState]),
  ["seed2-bridge", fixture("seed2-bridge-scene.json.gz")], ["river-bridges", fixture("river-bridges-scene.json.gz")]];
const rows = scenes.map(([name, state]) => {
  const { shore } = buildGroundBoundaryScene(state);
  const tolerance = outlineTolerance(shore.loops, 0.35);
  const bridgeEnds = shore.bridgeEnds.map(end => {
    let best: { offset: number; angle: number } | null = null;
    for (const loop of shore.loops) for (let index = 0; index < loop.smoothed.length; index += 1) {
      const a = loop.smoothed[index] as BoundaryPoint; const b = loop.smoothed[(index + 1) % loop.smoothed.length] as BoundaryPoint;
      const ca = end.axis === "y" ? a.x - end.mid.x : a.y - end.mid.y; const cb = end.axis === "y" ? b.x - end.mid.x : b.y - end.mid.y;
      if (ca * cb > 0 || ca === cb) continue;
      const t = ca / (ca - cb); const cross = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const offset = Math.abs(end.axis === "y" ? cross.y - end.mid.y : cross.x - end.mid.x);
      if (offset > 1) continue;
      let angle = Math.abs(Math.atan2(b.y - a.y, b.x - a.x) - (end.axis === "y" ? 0 : Math.PI / 2)) % Math.PI; angle = Math.min(angle, Math.PI - angle);
      if (best === null || offset < best.offset) best = { offset, angle: angle * 180 / Math.PI };
    }
    return { axis: end.axis, mid: end.mid, back: end.back, contactOffset: best === null ? null : Number(best.offset.toFixed(4)), tangentDegrees: best === null ? null : Number(best.angle.toFixed(3)) };
  });
  return { scene: name, loops: shore.loops.length, samples: tolerance.samples, maxTiles: Number(tolerance.max.toFixed(4)), over035: tolerance.over,
    decals: shore.loops.reduce((sum, loop) => sum + loop.decals.length, 0), bridgeEnds };
});
process.stdout.write(`${JSON.stringify({ limit: { outline: 0.35, contact: 0.15, tangentDegrees: 5 }, rows }, null, 2)}\n`);
