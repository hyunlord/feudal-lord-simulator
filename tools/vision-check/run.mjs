// npm run vision:check -- <vision_check.cli arguments>: the Astra visual checker (Python, uv), a helper tool only — not
// in npm test and not in check:merge. It prints each detector's status and calibration numbers (config/detectors.json),
// then runs `uv run python -m vision_check.cli <arguments>` in this folder. Without arguments it shows the CLI's help.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { detectors, performance } = JSON.parse(readFileSync(join(here, 'config', 'detectors.json'), 'utf8'));
const pct = value => `${Math.round(value * 1000) / 10}%`;
console.log('vision-check detectors (config/detectors.json):');
for (const [id, entry] of Object.entries(detectors)) {
  console.log(`  ${entry.status === 'use' ? '사용' : '실험'}  ${id.padEnd(18)} ${entry.label} — recall ${pct(entry.recall)}, precision ${pct(entry.precision)} (TP ${entry.tp} · FP ${entry.fp} · FN ${entry.fn})`);
}
console.log(`  ${performance}`);
if (Object.values(detectors).some(entry => entry.status !== 'use')) console.log('  실험 detectors are hints for a person to look at, never a gate.');
console.log('');
if (spawnSync('uv', ['--version'], { stdio: 'ignore' }).status !== 0) {
  console.error('vision-check: uv is not installed (https://docs.astral.sh/uv/); then: cd tools/vision-check && uv sync --group dev');
  process.exit(2);
}
const args = process.argv.slice(2);
const run = spawnSync('uv', ['run', 'python', '-m', 'vision_check.cli', ...(args.length === 0 ? ['--help'] : args)], { cwd: here, stdio: 'inherit' });
process.exit(run.status ?? 1);
