#!/usr/bin/env node
// The full suite split across the runner's cores (user order 2026-10-06: the clean clone took 35–60 min).
//   node scripts/remote/testShards.mjs [--jobs N] [--times <file>] [--out <dir>] [test files ...]
// Every test file runs as its own `tsx --test <file>` process (node --test does the same inside one runner), N at a
// time (default: the CPUs the run may use, 12 in fls-runs.slice), longest first by the times recorded in <times>
// (default ~/fls-runs/_cache/test-times.json; a file never timed counts as the longest so it starts early). Starting
// the long files first keeps the end from waiting on one late long file. The times are written back after the run.
// Output: one summary line like npm test's ("tests= pass= fail= …"), the failing files with their ✖ lines, and every
// file's log under <out> (default .remote/test-shards/). Exit 1 when any file fails.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { availableParallelism, homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; args.splice(i, 2); return v; };
const jobs = Number(opt("--jobs", process.env.FLS_TEST_JOBS ?? Math.min(12, availableParallelism())));
const timesFile = opt("--times", join(homedir(), "fls-runs/_cache/test-times.json"));
const out = resolve(opt("--out", join(ROOT, ".remote/test-shards")));
const files = args.length ? args : readdirSync(join(ROOT, "tests")).filter(f => f.endsWith(".test.ts")).map(f => `tests/${f}`).sort();

let times = {};
try { times = JSON.parse(readFileSync(timesFile, "utf8")); } catch { /* first run: no times yet */ }
const order = [...files].sort((a, b) => (times[b] ?? Infinity) - (times[a] ?? Infinity) || a.localeCompare(b));
mkdirSync(out, { recursive: true });

const totals = { tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
const failed = [];
const took = {};
const started = Date.now();
const tsx = join(ROOT, "node_modules/.bin/tsx");

function runOne(file) {
  return new Promise(done => {
    const t0 = Date.now();
    const log = join(out, file.replace(/\//g, "__") + ".log");
    const chunks = [];
    const child = spawn(tsx, ["--test", file], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: process.env });
    child.stdout.on("data", c => chunks.push(c)); child.stderr.on("data", c => chunks.push(c));
    child.on("close", code => {
      const text = Buffer.concat(chunks).toString("utf8");
      writeFileSync(log, text);
      took[file] = Date.now() - t0;
      for (const key of Object.keys(totals)) {
        const m = text.match(new RegExp(`^(?:ℹ|#) ${key} (\\d+)`, "m"));
        if (m) totals[key] += Number(m[1]);
      }
      if (code !== 0) failed.push({ file, lines: text.split("\n").filter(l => /^\s*(✖|not ok )/.test(l)).slice(0, 8) });
      done();
    });
  });
}

let next = 0;
await Promise.all(Array.from({ length: Math.max(1, jobs) }, async () => {
  while (next < order.length) await runOne(order[next++]);
}));
const wall = (Date.now() - started) / 1000;
const cpu = Object.values(took).reduce((a, b) => a + b, 0) / 1000;

// Write the times back (merged: a run of some files keeps the others' times).
try {
  mkdirSync(dirname(timesFile), { recursive: true });
  const merged = { ...times, ...took };
  writeFileSync(`${timesFile}.tmp`, JSON.stringify(merged)); renameSync(`${timesFile}.tmp`, timesFile);
} catch { /* the times are a speed-up only */ }

const slowest = Object.entries(took).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log(`${Object.entries(totals).map(([k, v]) => `${k}=${v}`).join(" ")} duration_ms=${Math.round(wall * 1000)} files=${files.length} jobs=${jobs}`);
console.log(`wall ${wall.toFixed(0)} s, file time summed ${cpu.toFixed(0)} s (${(cpu / wall).toFixed(1)} files at once on average), order: ${Object.keys(times).length ? "longest first by recorded times" : "no recorded times (alphabetical)"}`);
console.log(`slowest: ${slowest.map(([f, ms]) => `${f.replace("tests/", "")} ${(ms / 1000).toFixed(0)} s`).join(", ")}`);
for (const f of failed) { console.log(`✖ ${f.file}`); for (const l of f.lines) console.log(`   ${l.trim()}`); }
process.exit(failed.length ? 1 : 0);
