import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const base = dirname(fileURLToPath(import.meta.url));
const root = join(base, 'official-125');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => readFileSync(join(root, file));
const json = file => JSON.parse(file.endsWith('.gz') ? gunzipSync(read(file)) : read(file));
const manifest = json('manifest.json');
const config = json('config.json');
const sums = new Map(read('SHA256SUMS').toString().trim().split('\n').map(line => {
  const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
  assert.ok(match, `Invalid checksum line: ${line}`);
  return [match[2], match[1]];
}));
assert.deepEqual([...sums.keys()].sort(), [...manifest.files.map(row => row.file), 'manifest.json'].sort());
for (const [file, expected] of sums) assert.equal(sha(read(file)), expected, `SHA256SUMS: ${file}`);
for (const row of manifest.files) {
  const bytes = read(row.file);
  assert.equal(bytes.length, row.size, `Size: ${row.file}`);
  assert.equal(sha(bytes), row.sha256, `Archive hash: ${row.file}`);
  const raw = row.file.endsWith('.gz') && row.rawSha256 !== row.sha256 ? gunzipSync(bytes) : bytes;
  assert.equal(sha(raw), row.rawSha256, `Original hash: ${row.file}`);
}
const seeds = [1, 2, 3].map(seed => {
  const file = `original/seed-${seed}/manifest.json`;
  const raw = gunzipSync(read(`${file}.gz`));
  const original = manifest.originalFiles.find(row => row.file === file && row.retained);
  assert.ok(original, `Missing original provenance: ${file}`);
  assert.equal(raw.length, original.bytes);
  assert.equal(sha(raw), original.sha256);
  assert.equal(sha(raw), config.replayPins.find(row => row.seed === seed)?.manifestSha256);
  assert.equal(sha(raw), json(`capture/seed-${seed}/manifest.json.gz`).originalManifestSha256);
  const data = JSON.parse(raw);
  assert.equal(data.seed, seed);
  assert.equal(data.sourceRevision, manifest.sourceRevision);
  assert.equal(data.valid, true);
  assert.equal(data.replayVerified, true);
  return { seed, bytes: raw.length, compressedBytes: read(`${file}.gz`).length, sha256: sha(raw) };
});
function files(directory, prefix = '') {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name), relative = prefix + name;
    return statSync(path).isDirectory() ? files(path, `${relative}/`) : [relative];
  });
}
assert.deepEqual(files(root).sort(), [...sums.keys(), 'SHA256SUMS'].sort());
const folderBytes = files(base).reduce((total, file) => total + statSync(join(base, file)).size, 0);
assert.ok(folderBytes < 3_000_000, `Evidence folder exceeds 3 MB: ${folderBytes}`);
console.log(JSON.stringify({ verified: true, files: sums.size, folderBytes, seeds }, null, 2));
