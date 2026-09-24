import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('art installation requires an explicit source instead of a sibling checkout', () => {
  const { ACCEPTED_ART_SOURCE_ROOT: _source, SHARP_MODULE_PATH: _sharp, ...environment } = process.env;
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/installAcceptedArt.mjs'], {
    encoding: 'utf8', env: environment,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source directory is required.*ACCEPTED_ART_SOURCE_ROOT/);
});

test('art installation reports how to provide its optional sharp module', () => {
  const directory = mkdtempSync(join(tmpdir(), 'accepted-art-module-'));
  try {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/installAcceptedArt.mjs'], {
      encoding: 'utf8', env: { ...process.env, ACCEPTED_ART_SOURCE_ROOT: directory, SHARP_MODULE_PATH: join(directory, 'missing-sharp.cjs') },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unable to load the optional art tool sharp/);
    assert.match(result.stderr, /module search path or set SHARP_MODULE_PATH/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
