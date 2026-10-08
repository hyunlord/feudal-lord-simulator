import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

function object(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'registry-report-'));
  const input = join(dir, 'run.json');
  const context = join(dir, 'context.json');
  const output = join(dir, 'report.json');
  writeFileSync(input, JSON.stringify({ occurrences: [], decisionsByYear: { 1300: 2 } }));
  writeFileSync(context, JSON.stringify({ sourceRevision: 'snapshot-abc123', catalog: [], enabledEntryIds: [], legacyRange: { startYear: 1300, endYearExclusive: 1302 } }));
  return { dir, input, context, output, run: () => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/registryDistributionReport.ts', input, context, output], { encoding: 'utf8' }) };
}

test('CLI writes snapshot provenance hashes and preserves legacy missing response evidence', () => {
  const files = fixture();
  try {
    const result = files.run();
    assert.equal(result.status, 0, result.stderr);
    const parsed: unknown = JSON.parse(readFileSync(files.output, 'utf8'));
    const output = object(parsed);
    const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    assert.deepEqual(output.provenance, { sourceRevision: 'snapshot-abc123', inputSha256: hash(files.input), contextSha256: hash(files.context) });
    const density = object(output.summary).density;
    assert.ok(Array.isArray(density));
    assert.deepEqual(density[1], { year: 1301, allCommands: 0, askedResponses: null, arrivedQueue: null });
  } finally { rmSync(files.dir, { recursive: true, force: true }); }
});

test('malformed context or run fails without writing output', () => {
  const files = fixture();
  try {
    const goodContext = readFileSync(files.context, 'utf8');
    for (const context of [{ sourceRevision: ' ', catalog: [] }, { sourceRevision: 'abc', catalog: [{ id: 1, category: 'town' }] },
      { sourceRevision: 'abc', catalog: [], enabledEntryIds: [7] }, { sourceRevision: 'abc', catalog: [], legacyRange: { startYear: '1300', endYearExclusive: 1425 } }]) {
      writeFileSync(files.context, JSON.stringify(context));
      assert.notEqual(files.run().status, 0);
      assert.equal(existsSync(files.output), false);
    }
    writeFileSync(files.context, goodContext);
    writeFileSync(files.input, JSON.stringify({ occurrences: 'invalid' }));
    assert.notEqual(files.run().status, 0);
    assert.equal(existsSync(files.output), false);
  } finally { rmSync(files.dir, { recursive: true, force: true }); }
});


test('importing the CLI has no file or stdout side effects', () => {
  const imported = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    "await import('./scripts/registryDistributionReport.ts')"], { encoding: 'utf8' });
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stdout, '');
});
