import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { playwrightProvenance } from '../scripts/engineBSeasonReportCapture.mjs';

const shim = fileURLToPath(new URL('../scripts/remote/playwright-chrome-shim.mjs', import.meta.url));
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'eb-playwright-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const core = join(dir, 'index.mjs');
  writeFileSync(core, '// Metadata-only fixture; never imported.\n');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'playwright-core', version: '1.62.1' }));
  return { dir, core, env: { PLAYWRIGHT_MODULE: shim, FLS_PLAYWRIGHT_CORE: core, EB_PLAYWRIGHT_VERSION: '1.62.1' } };
}
test('standard remote shim pins its backing core package instead of nonexistent remote/package.json', t => {
  const { core, env } = fixture(t);
  const result = playwrightProvenance(env);
  assert.equal(result.version, '1.62.1');
  assert.equal(result.modulePath, realpathSync(shim));
  assert.equal(result.corePath, realpathSync(core));
  assert.match(result.moduleSha256, /^[a-f0-9]{64}$/);
  assert.match(result.packageSha256, /^[a-f0-9]{64}$/);
});
test('direct core entry remains supported without using an unrelated backing-core override', t => {
  const { core, env } = fixture(t);
  assert.equal(playwrightProvenance({ ...env, PLAYWRIGHT_MODULE: core, FLS_PLAYWRIGHT_CORE: '/missing' }).corePath, realpathSync(core));
});
test('unknown shim cannot borrow a valid backing core version', t => {
  const { dir, env } = fixture(t), other = join(dir, 'other-shim.mjs');
  writeFileSync(other, '// Not the standard shim.\n');
  assert.throws(() => playwrightProvenance({ ...env, PLAYWRIGHT_MODULE: other }), /index.mjs/);
});
test('shim requires absolute backing core and explicit matching version', t => {
  const { env } = fixture(t);
  for (const core of [undefined, 'index.mjs']) assert.throws(() => playwrightProvenance({ ...env, FLS_PLAYWRIGHT_CORE: core }), /Absolute.*core/);
  for (const version of [undefined, '', '1.61.0']) assert.throws(() => playwrightProvenance({ ...env, EB_PLAYWRIGHT_VERSION: version }), /version pin/);
});
test('core metadata must identify playwright-core, not merely have the expected version', t => {
  const { dir, env } = fixture(t);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'other', version: '1.62.1' }));
  assert.throws(() => playwrightProvenance(env), /playwright-core/);
});
