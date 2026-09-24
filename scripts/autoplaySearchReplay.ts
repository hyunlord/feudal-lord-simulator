import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideNextAction } from '../src/engine/autoplay';
import type { FoodDiagnosticCollector } from '../src/engine/autoplayFoodDiagnostic';
import type { GameState } from '../src/engine/engine.types';

interface ReplayCase { id: string; file: string; tick: number; maxHousingLots: number; sha256: string }
const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '../fixtures/autoplay-search-budget');
const manifest: { sourceCommit: string; cases: ReplayCase[] } = JSON.parse(readFileSync(join(fixtures, 'manifest.json'), 'utf8'));

if (process.argv[2] === '--case') {
  const file = process.argv[3];
  if (file === undefined) throw new Error('Missing extracted fixture');
  const state: GameState = JSON.parse(readFileSync(file, 'utf8'));
  const collector: FoodDiagnosticCollector = {};
  const maxHousingLots = Number(process.argv[4]);
  const started = performance.now();
  const action = decideNextAction(state, { maxHousingLots }, collector);
  const elapsedMs = performance.now() - started;
  const repeated = decideNextAction(structuredClone(state), { maxHousingLots });
  console.log(JSON.stringify({ tick: state.tick, elapsedMs, action, search: collector.search,
    deterministic: JSON.stringify(action) === JSON.stringify(repeated) }));
} else {
  const directory = mkdtempSync(join(tmpdir(), 'autoplay-search-replay-'));
  const output = process.argv[2];
  const ids = process.argv.slice(3);
  const cases = manifest.cases.filter(entry => ids.length === 0 || ids.includes(entry.id));
  if (cases.length === 0) throw new Error('No matching replay cases');
  try {
    const unpack = spawnSync('tar', ['-xJf', join(fixtures, 'slow-inputs.tar.xz'), '-C', directory], { encoding: 'utf8' });
    if (unpack.status !== 0) throw new Error(unpack.stderr || 'Fixture extraction failed');
    const results = cases.map(entry => {
      const file = join(directory, entry.file);
      const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
      if (sha256 !== entry.sha256) throw new Error(`Fixture hash mismatch: ${entry.id}`);
      const worker = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--case', file, String(entry.maxHousingLots)],
        { encoding: 'utf8', timeout: 25_000 });
      const result = worker.status === 0 ? JSON.parse(worker.stdout) as { elapsedMs: number; deterministic: boolean }
        : { error: worker.error?.message ?? worker.stderr, elapsedMs: null, deterministic: false };
      const passed = result.elapsedMs !== null && result.elapsedMs < (entry.id === 'seed3-28080' ? 1000 : 10_000) && result.deterministic;
      const row = { id: entry.id, passed, ...result };
      console.error(JSON.stringify(row));
      return row;
    });
    const report = { sourceCommit: manifest.sourceCommit, count: results.length, passed: results.filter(row => row.passed).length, results };
    if (output !== undefined) writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    else console.log(JSON.stringify(report, null, 2));
    if (report.passed !== report.count) process.exitCode = 1;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
