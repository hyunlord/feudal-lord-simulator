import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { ArtBundle } from '../src/render/art/artContract';
import { checkCatalogFiles } from '../scripts/checkArtCatalog';
import { encodeJpeg } from '../scripts/keyartDerivatives';
import { writePng } from '../scripts/processBuildingSprite';

test('catalog file gate detects altered bytes, dimensions and pixels without changing source', () => {
  const root = mkdtempSync(join(tmpdir(), 'art-files-'));
  try {
    mkdirSync(join(root, 'assets-inbox'));
    mkdirSync(join(root, 'public/assets'), { recursive: true });
    const source = join(root, 'assets-inbox/approved.png');
    const runtime = join(root, 'public/assets/approved.png');
    writePng(source, { dimensions: { width: 2, height: 1 }, rgba: Uint8Array.from([1, 2, 3, 255, 4, 5, 6, 128]) });
    const bytes = readFileSync(source);
    const hash = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(runtime, bytes);
    const bundle: ArtBundle = { schemaVersion: 1, bundleId: 'approved-bundle', rules: [], entries: [{
      id: 'approved', kind: 'building-body', image: { url: 'assets/approved.png', width: 2, height: 1 },
      provenance: { inboxFile: 'assets-inbox/approved.png', sourceSha256: hash, runtimeSha256: hash },
      geometry: { pivot: { x: 1, y: 1 }, scale: 1, allowMirror: false }, buildingKinds: ['house'], levels: [0], variantId: 'a',
    }] };
    assert.deepEqual(checkCatalogFiles(root, [bundle])[0]?.errors, []);
    writePng(runtime, { dimensions: { width: 1, height: 1 }, rgba: Uint8Array.from([1, 2, 3, 255]) });
    assert.deepEqual(checkCatalogFiles(root, [bundle])[0]?.errors, [
      'Runtime SHA differs from contract', 'Runtime dimensions differ from contract', 'Installed pixels differ from approved source',
    ]);
    assert.deepEqual(readFileSync(source), bytes);
    rmSync(runtime);
    symlinkSync('/etc/hosts', runtime);
    assert.match(checkCatalogFiles(root, [bundle])[0]?.errors[0] ?? '', /escapes repository/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function withJpegFiles(run: (root: string, bundle: ArtBundle, bytes: Buffer) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'art-jpeg-'));
  try {
    mkdirSync(join(root, 'assets-inbox'));
    mkdirSync(join(root, 'public/assets'), { recursive: true });
    const bytes = encodeJpeg({ width: 2, height: 2, data: Uint8Array.from(Array.from({ length: 4 }, () => [240, 20, 30, 255]).flat()) }, 90);
    const hash = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(join(root, 'assets-inbox/approved.jpg'), bytes);
    writeFileSync(join(root, 'public/assets/approved.jpg'), bytes);
    const bundle: ArtBundle = { schemaVersion: 1, bundleId: 'jpeg-bundle', rules: [], entries: [{
      id: 'jpeg', kind: 'building-body', image: { url: 'assets/approved.jpg', width: 2, height: 2 },
      provenance: { inboxFile: 'assets-inbox/approved.jpg', sourceSha256: hash, runtimeSha256: hash },
      geometry: { pivot: { x: 1, y: 1 }, scale: 1, allowMirror: false }, buildingKinds: ['house'], levels: [0], variantId: 'a',
    }] };
    run(root, bundle, bytes);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('JPEG gate decodes approved unchanged bytes and checks declared dimensions', () => withJpegFiles((root, bundle) => {
  assert.deepEqual(checkCatalogFiles(root, [bundle])[0]?.errors, []);
  const wrongDimensions = { ...bundle, entries: bundle.entries.map(entry => ({ ...entry, image: { ...entry.image, width: 3 } })) };
  assert.deepEqual(checkCatalogFiles(root, [wrongDimensions])[0]?.errors, ['Runtime dimensions differ from contract']);
}));

test('JPEG gate detects altered decoded pixels', () => withJpegFiles((root, bundle) => {
  writeFileSync(join(root, 'public/assets/approved.jpg'), encodeJpeg({ width: 2, height: 2,
    data: Uint8Array.from(Array.from({ length: 4 }, () => [20, 240, 30, 255]).flat()) }, 90));
  const result = checkCatalogFiles(root, [bundle])[0];
  assert.equal(result?.samePixels, false);
  assert.ok(result?.errors.includes('Installed pixels differ from approved source'));
}));

for (const damage of ['truncated', 'corrupt', 'unsupported'] as const) {
  test(`JPEG gate fails closed for ${damage} source even when both files and declared hashes match`, () => withJpegFiles((root, bundle, bytes) => {
    const damaged = damage === 'truncated' ? bytes.subarray(0, bytes.length - 2)
      : damage === 'corrupt' ? Buffer.from([255, 216, 255, 218, 0, 2, 1, 2, 255, 217]) : Buffer.from('not an image');
    const hash = createHash('sha256').update(damaged).digest('hex');
    writeFileSync(join(root, 'assets-inbox/approved.jpg'), damaged);
    writeFileSync(join(root, 'public/assets/approved.jpg'), damaged);
    const changed = { ...bundle, entries: bundle.entries.map(entry => ({ ...entry,
      provenance: { ...entry.provenance, sourceSha256: hash, runtimeSha256: hash } })) };
    const result = checkCatalogFiles(root, [changed])[0];
    assert.equal(result?.samePixels, false);
    assert.ok(result && result.errors.length > 0);
  }));
}

test('JPEG gate rejects metadata-only changes even when decoded pixels and declared hashes agree', () => withJpegFiles((root, bundle, bytes) => {
  const changed = Buffer.concat([bytes.subarray(0, 2), Buffer.from([255, 254, 0, 3, 65]), bytes.subarray(2)]);
  writeFileSync(join(root, 'public/assets/approved.jpg'), changed);
  const hash = createHash('sha256').update(changed).digest('hex');
  const declared = { ...bundle, entries: bundle.entries.map(entry => ({ ...entry,
    provenance: { ...entry.provenance, runtimeSha256: hash } })) };
  const result = checkCatalogFiles(root, [declared])[0];
  assert.equal(result?.samePixels, true);
  assert.deepEqual(result?.errors, ['JPEG installation must preserve approved bytes']);
}));

test('JPEG gate rejects a PNG transcode with a declared matching runtime hash', () => withJpegFiles((root, bundle) => {
  const runtime = join(root, 'public/assets/approved.jpg');
  writePng(runtime, { dimensions: { width: 2, height: 2 }, rgba: new Uint8Array(16) });
  const hash = createHash('sha256').update(readFileSync(runtime)).digest('hex');
  const declared = { ...bundle, entries: bundle.entries.map(entry => ({ ...entry,
    provenance: { ...entry.provenance, runtimeSha256: hash } })) };
  assert.ok(checkCatalogFiles(root, [declared])[0]?.errors.includes('Runtime image format differs from approved source'));
}));
