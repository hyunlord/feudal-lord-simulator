// SMOOTH-1: redo the analysis of recorded runs with the current scripts/perf/hitchTrace.ts, so every run in a report
// is read by the same code (the record — the page's frames and moments — and its trace are kept per run).
//   tsx scripts/perf/hitchReanalyse.ts <trace dir> <summary dir> [--machine <label>]
// For each <run>.record.json beside <run>.json.gz (or without a trace: a --no-trace control) writes <summary dir>/<run>.json.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { analyseRun, type FrameRecord, type MomentMark } from "./hitchTrace";

const [traceDir, summaryDir] = process.argv.slice(2);
if (traceDir === undefined || summaryDir === undefined) throw new Error("Usage: hitchReanalyse.ts <trace dir> <summary dir>");
mkdirSync(summaryDir, { recursive: true });
const PARSE = /^(?<machine>.+?)-(?<scene>ch\d-[a-z0-9]+|ops-[a-z]+|moment-[a-z0-9]+)-x(?<speed>[135])(?:-(?<action>camera|placement|drawers))?(?<notrace>-notrace)?$/;
for (const file of readdirSync(traceDir).filter(name => name.endsWith(".record.json")).sort()) {
  const run = file.replace(/\.record\.json$/, "");
  const match = PARSE.exec(run); if (match?.groups === undefined) { console.log(`skip ${run}: name`); continue; }
  const record = JSON.parse(readFileSync(join(traceDir, file), "utf8"));
  const gz = join(traceDir, `${run}.json.gz`); const tracePath = existsSync(gz) ? gz : null;
  const started = Date.now();
  const analysis = await analyseRun({ frames: record.frames as FrameRecord[], marks: record.marks as MomentMark[], startMarkPageMs: record.startMarkPageMs, tracePath });
  const { machine, scene, speed, action, notrace } = match.groups;
  const summary = { run, machine, scene, speed: Number(speed), action: action ?? "none", control: notrace !== undefined ? "no-trace" : null,
    seconds: Math.round(((record.frames.at(-1)?.t ?? 0) - (record.frames[0]?.t ?? 0)) / 1000), loadSeconds: record.loadSeconds,
    page: { dpr: record.dpr, viewport: record.viewport, tickEnd: record.tick, population: record.population, buildings: record.buildings },
    trace: tracePath === null ? null : { file: tracePath, bytes: statSync(tracePath).size }, moments: record.marks, actions: record.actions ?? [],
    errors: record.errors ?? [], ...analysis };
  writeFileSync(join(summaryDir, `${run}.json`), `${JSON.stringify(summary, null, 1)}\n`);
  const s = analysis.stats;
  console.log(`${run}: p99 ${s.p99} max ${s.max} >33ms ${s.over33} (${s.over33PerMin}/min) >50ms ${s.over50} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
}
