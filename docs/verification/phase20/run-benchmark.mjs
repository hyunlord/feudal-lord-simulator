import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [state, root, url, playwright, output] = process.argv.slice(2);
if (!state || !root || !url || !playwright || !output) {
  throw new Error('Usage: node run-benchmark.mjs STATE ROOT URL PLAYWRIGHT_MODULE OUTPUT_DIR');
}
const benchmark = fileURLToPath(new URL('../phase19/paired-work-benchmark.mjs', import.meta.url));
for (const dpr of [1, 2]) {
  for (const condition of ['paused', 'running', 'drag']) {
    const args = [benchmark, '--task', 'phase20-final', '--single', 'true',
      '--dpr', String(dpr), '--condition', condition, '--state', resolve(state),
      '--output', resolve(output), '--before-url', url, '--after-url', url,
      '--before-root', resolve(root), '--after-root', resolve(root),
      '--playwright', resolve(playwright)];
    console.log(JSON.stringify({ dpr, condition, args }));
    const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
