// Measures how much of a save is pathCache and whether dropping it changes the simulation.
// Measurement only: the save format is unchanged.
// Usage: tsx scripts/measureSavePathCache.ts [--ticks 24000] [--out docs/verification/b8-save/path-cache.json]
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { canonicalStateHash } from "./verifySaveDeterminism";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT = fileURLToPath(import.meta.url);
const CASES = [
  "fixtures/saves/v1/new-game.save.json",
  "fixtures/saves/v1/population-176.save.json",
  "fixtures/saves/v1/palisade-construction.save.json",
  "fixtures/determinism/seed1/final-state.json",
] as const;

function load(file: string): GameState {
  return decodeSave(new Uint8Array(readFileSync(resolve(ROOT, file)))).envelope.state;
}

function run(file: string, emptyCache: boolean, ticks: number) {
  let state = load(file);
  if (emptyCache) state = { ...state, pathCache: {} };
  const started = performance.now();
  for (let index = 0; index < ticks; index += 1) state = advanceTick(state);
  return { hash: canonicalStateHash(state), tick: state.tick, ms: performance.now() - started, pathCacheEntriesAfter: Object.keys(state.pathCache).length };
}

function worker(file: string, emptyCache: boolean, ticks: number): Promise<ReturnType<typeof run>> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", SCRIPT, "--worker", JSON.stringify({ file, emptyCache, ticks })], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", chunk => { out += String(chunk); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolvePromise(JSON.parse(out.trim().split("\n").at(-1) ?? "{}")) : reject(new Error(`${file} exited ${code}`)));
  });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === SCRIPT) {
  const args = process.argv.slice(2);
  if (args[0] === "--worker") {
    const input = JSON.parse(args[1] ?? "{}") as { file: string; emptyCache: boolean; ticks: number };
    process.stdout.write(`${JSON.stringify(run(input.file, input.emptyCache, input.ticks))}\n`);
  } else {
    const at = (name: string, fallback: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] ?? fallback : fallback; };
    const ticks = Number(at("--ticks", "24000"));
    const rows = await Promise.all(CASES.map(async file => {
      const state = load(file);
      const bytes = encodeSave({ state, createdAt: "x", savedAt: "x" }).bytes.byteLength;
      const without = encodeSave({ state: { ...state, pathCache: {} }, createdAt: "x", savedAt: "x" }).bytes.byteLength;
      const [withCache, emptied] = await Promise.all([worker(file, false, ticks), worker(file, true, ticks)]);
      return { file, tick: state.tick, population: state.population, pathCacheEntries: Object.keys(state.pathCache).length,
        saveBytes: bytes, saveBytesWithoutPathCache: without, pathCacheShare: Number(((bytes - without) / bytes).toFixed(4)),
        ticks, sameResultWithEmptiedCache: withCache.hash === emptied.hash, withCache, emptied };
    }));
    const report = { schemaVersion: 1, measurement: "pathCache share of the save and 24,000-tick result with pathCache emptied at load (separate processes)", rows };
    const out = at("--out", "");
    if (out !== "") { mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(resolve(out), `${JSON.stringify(report, null, 2)}\n`); }
    for (const row of rows) {
      process.stdout.write(`${row.file}: tick ${row.tick} pathCache ${row.pathCacheEntries} entries, ${(row.pathCacheShare * 100).toFixed(1)}% of ${row.saveBytes} B; ` +
        `emptied → same result after ${ticks} ticks: ${row.sameResultWithEmptiedCache} (ms ${row.withCache.ms.toFixed(0)} vs ${row.emptied.ms.toFixed(0)})\n`);
    }
  }
}
