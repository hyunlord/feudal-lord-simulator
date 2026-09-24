import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { parseGrowthOptions } from './phase19GrowthMetrics';
import { superviseGrowthRecording } from './growthStateRecordSupervisor';

// CLI: npx tsx scripts/growthStateRecord.ts 24 1200000 output/record/seed1 1 1500
// Last argument is wall-clock seconds (maximum 1500); target 48 is measurement only.
const args = process.argv.slice(2);
const options = parseGrowthOptions(args);
const output = args[2];
if (output === undefined) throw new RangeError('Expected targetLots maxTicks outputDirectory seed [wallTimeSeconds=1500]');
const seconds = Number(args[4] ?? 1_500);
if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 1_500) throw new RangeError('wallTimeSeconds must be >0 and <=1500');
const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...values: string[]) => execFileSync('git', values, { cwd: root, encoding: 'utf8' }).trim();
const source = { commit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain', '--', 'src', 'scripts').length > 0 };
const result = await superviseGrowthRecording({ ...options, output: resolve(output), worker: fileURLToPath(new URL('./growthStateRecordWorker.ts', import.meta.url)), wallTimeMs: seconds * 1_000 });
const record = { source, ...result };
writeFileSync(resolve(output, 'summary.json'), JSON.stringify(record, null, 2));
process.stdout.write(`${JSON.stringify(record)}\n`);
if (result.finalTick === null || result.exit.code !== 0 && result.stopReason !== 'wall-time-budget') process.exitCode = 1;
