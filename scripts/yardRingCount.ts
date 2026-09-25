// INSTALL-4e gate 4: yard hurdle rings over the test scenes (the seed 2 arable scene, the C25 zoned board, seeds 1-5):
// pieces by kind, and what stays open (FenceWant) by kind. Run on a trunk worktree and on this branch to compare.
// Usage: npx tsx scripts/yardRingCount.ts [out.json]
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { buildGroundBoundaryScene } from "../src/render/groundBoundaryScene";
import { seedGroundState } from "./boundaryFixtureStates";
import { c25ZonedState } from "./c25Board";

const arable = JSON.parse(gunzipSync(readFileSync(new URL("../tests/fixtures/boundary/seed2-arable-scene.json.gz", import.meta.url))).toString("utf8")) as GameState;
const scenes: readonly [string, GameState][] = [["seed2-arable", arable], ["c25-zoned", c25ZonedState()],
  ...([1, 2, 3, 4, 5] as const).map(seed => [`seed${seed}`, seedGroundState(seed)] as [string, GameState])];
const count = (values: readonly string[]): Record<string, number> => values.reduce<Record<string, number>>((all, value) => ({ ...all, [value]: (all[value] ?? 0) + 1 }), {});
const rows = scenes.map(([name, state]) => {
  const { hurdles, wants } = buildGroundBoundaryScene(state).yardProps;
  const fenced = new Set(hurdles.map(piece => piece.buildingId));
  const open = new Set(wants.filter(want => fenced.has(want.buildingId)).map(want => want.buildingId));
  return { scene: name, fencedYards: fenced.size, closedYards: fenced.size - open.size, pieces: count(hurdles.map(piece => piece.kind)), wants: count(wants.map(want => want.kind)) };
});
const total = { fencedYards: rows.reduce((sum, row) => sum + row.fencedYards, 0), closedYards: rows.reduce((sum, row) => sum + row.closedYards, 0),
  wants: rows.reduce((sum, row) => sum + Object.values(row.wants).reduce((a, b) => a + b, 0), 0) };
const out = JSON.stringify({ rows, total }, null, 1);
if (process.argv[2] !== undefined) writeFileSync(process.argv[2], out + "\n");
console.log(out);
