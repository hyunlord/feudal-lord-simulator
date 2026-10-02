// npm run vision:check -- <vision_check.cli arguments>: the Astra visual checker (Python, uv), a helper tool only — not
// in npm test and not in check:merge. It prints each detector's status with its holdout, calibration and sample numbers
// (config/detectors.json), then runs `uv run python -m vision_check.cli <arguments>` in this folder. Without arguments it shows the CLI's help.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { detectors, performance } = JSON.parse(readFileSync(join(here, 'config', 'detectors.json'), 'utf8'));
const pct = value => (value === null ? 'N/A' : `${Math.round(value * 1000) / 10}%`);
const rp = ({ recall, precision }) => `R ${pct(recall)} / P ${pct(precision)}`;
console.log('vision-check detectors (config/detectors.json):');
for (const [id, { status, label, holdout, calibration, sample }] of Object.entries(detectors)) {
  console.log(`  ${status === 'use' ? '사용' : '실험'}  ${id.padEnd(18)} ${label}`);
  console.log(`        holdout ${rp(holdout)} (TP ${holdout.tp} · FP ${holdout.fp} · FN ${holdout.fn}) · calibration ${rp(calibration)}`
    + ` · sample ${sample.drawn}: true ${sample.true}, false ${sample.false}, uncertain ${sample.uncertain}`);
}
console.log(`  ${performance}`);
console.log('  실험 detectors are hints for a person to look at; no detector is a gate.\n');
if (spawnSync('uv', ['--version'], { stdio: 'ignore' }).status !== 0) {
  console.error('vision-check: uv is not installed (https://docs.astral.sh/uv/); then: cd tools/vision-check && uv sync --group dev');
  process.exit(2);
}
const args = process.argv.slice(2);
const run = spawnSync('uv', ['run', 'python', '-m', 'vision_check.cli', ...(args.length === 0 ? ['--help'] : args)], { cwd: here, stdio: 'inherit' });
process.exit(run.status ?? 1);
