// Engine tick cost on the perf:gate's 1380 town (fixtures/perf-gate/ch4-1380): wall time per advanceTick over N ticks,
// after 50 warm-up ticks. For trunk-vs-branch engine comparisons on the same host (the DGX), not a frame gate.
// tsx scripts/perf/tickTiming.ts [ticks] [repeats]
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { migrateSaveToLatest } from "../../src/save/migrations/index";
import { advanceTick } from "../../src/engine/tick";
import type { GameState } from "../../src/engine/engine.types";

const ticks = Number(process.argv[2] ?? 3000);
const repeats = Number(process.argv[3] ?? 3);
const raw = JSON.parse(gunzipSync(readFileSync("fixtures/perf-gate/ch4-1380.save.json.gz")).toString("utf8"));
for (let round = 0; round < repeats; round++) {
  let state = (migrateSaveToLatest(raw).value as { state: GameState }).state;
  for (let i = 0; i < 50; i++) state = advanceTick(state);
  const times: number[] = [];
  const started = performance.now();
  for (let i = 0; i < ticks; i++) {
    const before = performance.now();
    state = advanceTick(state);
    times.push(performance.now() - before);
  }
  const total = performance.now() - started;
  const sorted = [...times].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))]!.toFixed(2);
  console.log(JSON.stringify({ round, ticks, totalMs: Math.round(total), meanMs: +(total / ticks).toFixed(3), p50: q(0.5), p99: q(0.99), max: q(1),
    over8: times.filter(ms => ms > 8).length, pop: state.population }));
}
