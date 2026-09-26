// DGX performance baseline (REMOTE-1): folds scripts/renderStageBenchmark.mjs cell files into one compact record, or
// compares a new measurement with a recorded one. Performance gates compare DGX with DGX only; never mix in Mac
// numbers.
//   node scripts/remote/perf-baseline.mjs --raw <cell dir> --out perf/baseline-dgx-<sha>.json [--report summary.md]
//   node scripts/remote/perf-baseline.mjs --raw <cell dir> --out current.json --compare perf/baseline-dgx-<sha>.json \
//     [--report compare.md]
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) =>
  value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
if (!args.raw || !args.out) throw new Error('Usage: perf-baseline.mjs --raw <dir> --out <file> [--compare <baseline>] [--report <md>]');

const pick = stats => stats === undefined || stats === null ? null
  : { count: stats.count, median: stats.median, p95: stats.p95, mean: stats.mean };
const cells = [];
for (const file of (await readdir(args.raw)).filter(name => name.endsWith('.json')).sort()) {
  const record = JSON.parse(await readFile(join(args.raw, file), 'utf8'));
  cells.push({
    name: record.name, city: record.city, dpr: record.dpr, camera: record.camera, cpu: record.cpu,
    frameWorkMs: pick(record.frameWork), tickWorkMs: pick(record.tickWork), rafMs: pick(record.raf),
    effectiveSpeed: record.effectiveSpeed, errors: record.errors?.length ?? 0,
  });
}
if (cells.length === 0) throw new Error(`No benchmark cells in ${args.raw}`);
const first = JSON.parse(await readFile(join(args.raw, (await readdir(args.raw)).find(name => name.endsWith('.json'))), 'utf8'));
const record = {
  kind: 'dgx-perf-baseline', commit: first.commit, dirtySource: first.dirtySource, measuredAt: new Date().toISOString(),
  host: first.host, browser: first.browser, harness: 'scripts/renderStageBenchmark.mjs', harnessSha256: first.harnessSha256,
  protocol: first.protocol, server: 'vite dev server on the DGX (127.0.0.1, port 4300-4399)',
  limits: 'systemd user scope MemoryMax=48G CPUQuota=1200%, nice 10 (scripts/remote/run.sh)',
  cells,
};
await mkdir(dirname(args.out), { recursive: true });
await writeFile(args.out, `${JSON.stringify(record, null, 2)}\n`);

const f1 = value => value === null || value === undefined ? '—' : value.toFixed(1);
let report;
if (args.compare) {
  const base = JSON.parse(await readFile(args.compare, 'utf8'));
  if (base.kind !== 'dgx-perf-baseline') throw new Error(`${args.compare} is not a DGX baseline; compare DGX with DGX only`);
  const rows = ['| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |', '|---|---|---|---|'];
  for (const cell of cells) {
    const old = base.cells.find(candidate => candidate.name === cell.name);
    const ratio = old?.frameWorkMs?.p95 ? cell.frameWorkMs.p95 / old.frameWorkMs.p95 : null;
    rows.push(`| ${cell.name} | ${old ? `${f1(old.frameWorkMs.median)} / ${f1(old.frameWorkMs.p95)}` : '—'} | ${f1(cell.frameWorkMs.median)} / ${f1(cell.frameWorkMs.p95)} | ${ratio === null ? '—' : `${(ratio * 100).toFixed(0)}%`} |`);
  }
  report = `DGX frameWork (ms), baseline ${base.commit.slice(0, 7)} vs ${record.commit.slice(0, 7)}\n\n${rows.join('\n')}\n`;
} else {
  const rows = ['| 칸 | frameWork 중앙 / p95 | tick 중앙 / p95 | rAF 중앙 / p95 |', '|---|---|---|---|'];
  for (const cell of cells) rows.push(`| ${cell.name} | ${f1(cell.frameWorkMs.median)} / ${f1(cell.frameWorkMs.p95)} | ${f1(cell.tickWorkMs?.median)} / ${f1(cell.tickWorkMs?.p95)} | ${f1(cell.rafMs?.median)} / ${f1(cell.rafMs?.p95)} |`);
  report = `DGX baseline ${record.commit.slice(0, 7)} (${record.browser}, ${record.host.cpu ?? record.host.arch})\n\n${rows.join('\n')}\n`;
}
if (args.report) await writeFile(args.report, report);
