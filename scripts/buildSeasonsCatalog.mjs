import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const metadata = JSON.parse(await readFile(resolve(root, 'docs/ops/install-plan-20261003/METADATA/nature.json'), 'utf8'));
const entries = [];
for (const { file, metadata: m } of metadata) {
  if (!file.startsWith('wave39/candidates-20260930/assets/snow/')) continue;
  const bytes = await readFile(resolve(root, 'assets-inbox', file));
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== (m.runtimeSha256 ?? m.sha256)) throw new Error(`Source SHA mismatch: ${file}`);
  const url = `assets/wave39/${file.split('/assets/')[1]}`;
  const width = Number(m.width), height = Number(m.height);
  const pivot = { x: Number(m.pivotX), y: Number(m.pivotY) };
  const role = file.includes('footprints') ? 'snow-footprint' : file.includes('blowing') ? 'blowing-snow' : 'snow';
  const particle = role !== 'snow-footprint';
  const count = Number(m.frameCount);
  entries.push({ id: `wave39:${m.assetId ?? m.id}`, kind: particle ? 'weather-particle' : 'ground-prop', ...(particle ? {} : { placement: 'nature-ground' }), role, group: 'all',
    image: { url, width, height }, provenance: { inboxFile: `assets-inbox/${file}`, sourceSha256: sha, runtimeSha256: sha },
    geometry: { pivot, scale: particle ? 1 : 0.25, allowMirror: false }, opacity: Number(m.recommendedAlpha),
    minZoom: role === 'blowing-snow' ? 0.6 : 1,
    ...(particle ? { frames: Array.from({ length: count }, (_, i) => ({ sourceRect: { x: i * Number(m.frameWidth), y: 0, width: Number(m.frameWidth), height: Number(m.frameHeight) }, pivot, durationMs: role === 'blowing-snow' ? 200 : 4000 })) } : {}) });
  await mkdir(dirname(resolve(root, 'public', url)), { recursive: true });
  await copyFile(resolve(root, 'assets-inbox', file), resolve(root, 'public', url));
}
if (entries.length !== 6) throw new Error(`Expected six snow candidates, got ${entries.length}`);
const rules = ['snow', 'blowing-snow', 'snow-footprint'].map(role => ({ id: `nature-${role}-all`, kind: role === 'snow-footprint' ? 'ground-prop' : 'weather-particle', slot: `nature-${role}`, priority: 0,
  conditions: [{ op: 'eq', field: 'role', value: role }, { op: 'eq', field: 'group', value: 'all' }],
  variants: entries.filter(e => e.role === role).map(e => ({ assetId: e.id, weight: 1 })), fallback: 'none' }));
const path = resolve(root, 'src/render/art/catalog.json');
const catalog = JSON.parse(await readFile(path, 'utf8'));
await writeFile(path, JSON.stringify([...catalog.filter(b => b.bundleId !== 'wave39-seasons-snow'), { schemaVersion: 1, bundleId: 'wave39-seasons-snow', entries, rules }], null, 2) + '\n');
execFileSync('python3', [resolve(root, 'scripts/buildSnowFootprintSupport.py')]);
console.log(JSON.stringify({ candidates: entries.length, footprintsObservationOnly: 2, runtimeFilesWritten: entries.length }));
