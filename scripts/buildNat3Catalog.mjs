import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const metadata = JSON.parse(await readFile(resolve(root, 'docs/ops/install-plan-20261003/METADATA/nature.json'), 'utf8'));
const bundleId = 'wave39-nat3-world';
const entries = [];
const groups = new Map();
for (const { file, metadata: m } of metadata) {
  if (!file.startsWith('wave39/candidates-20260930/assets/')) continue;
  const sourceId = m.assetId ?? m.id;
  const name = file.split('/').at(-1);
  let role, group = 'all';
  if (name.startsWith('rain_splash_')) { role = 'splash'; group = name.split('_')[2]; }
  else if (name.startsWith('roof_leaves')) role = 'leaf-roof';
  else if (name.startsWith('rain_streak_')) role = 'rain';
  else if (name.startsWith('ground_leaves_')) {
    role = 'leaf-ground';
    group = name.includes('birch') || name.includes('windrow_b') ? 'narrow-deciduous' : name.includes('large') ? 'mixed' : 'broad-deciduous';
  } else if (name.startsWith('floating_leaves')) role = 'leaf-water';
  else if (name.startsWith('puddle_')) role = 'puddle';
  else if (name.startsWith('mud_scar_')) role = 'mud';
  else if (name.startsWith('rain_wet_mask_')) role = name.includes('grass') ? 'wet-grass' : 'wet-soil';
  else if (name.startsWith('falling_')) {
    role = 'leaf-flight';
    group = name.includes('oak') || name.includes('beech') ? 'broad-deciduous' : 'narrow-deciduous';
  } else if (name.startsWith('wind_leaves_group_')) role = 'leaf-wind';
  else continue;
  const input = resolve(root, 'assets-inbox', file);
  const bytes = await readFile(input);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== (m.runtimeSha256 ?? m.sha256)) throw new Error(`Source SHA mismatch: ${file}`);
  for (let offset = 8; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'caBX') throw new Error(`Source requires explicit C2PA stripping: ${file}`);
    offset += size + 12;
  }
  const relative = file.split('/assets/')[1];
  const url = `assets/wave39/${relative}`;
  const width = Number(m.width), height = Number(m.height);
  const pivot = { x: Number(m.pivotX), y: Number(m.pivotY) };
  const particle = ['rain', 'leaf-flight', 'leaf-wind', 'splash'].includes(role);
  const kind = particle ? 'weather-particle' : 'ground-prop';
  let scale = 1;
  if (role === 'leaf-flight') scale = 0.375;
  else if (role === 'leaf-wind') scale = 0.5;
  else if (!particle) scale = width === 32 ? 12 / 32 : width === 64 ? 24 / 64 : width === 96 ? 40 / 96 : 0.5;
  const minZoom = role === 'rain' ? 0 : name.includes('windrow') || name.includes('large') || role.startsWith('wet-') ? 0.6 : 1;
  const entry = { id: `wave39:${sourceId}`, kind, role, group, image: { url, width, height },
    provenance: { inboxFile: `assets-inbox/${file}`, sourceSha256: sha, runtimeSha256: sha },
    geometry: { pivot, scale, allowMirror: false }, opacity: Number(m.recommendedAlpha), minZoom };
  if (particle) {
    const count = Number(m.frameCount), fw = Number(m.frameWidth), fh = Number(m.frameHeight);
    entry.frames = Array.from({ length: count }, (_, i) => ({ sourceRect: { x: i * fw, y: 0, width: fw, height: fh }, pivot, durationMs: role === 'splash' ? 50 : role === 'leaf-wind' ? 200 : 160 }));
  } else entry.placement = 'nature-ground';
  entries.push(entry);
  const key = `${role}:${group}`;
  const variants = groups.get(key) ?? [];
  variants.push({ assetId: entry.id, weight: 1 }); groups.set(key, variants);
  await mkdir(dirname(resolve(root, 'public', url)), { recursive: true });
  await copyFile(input, resolve(root, 'public', url));
}
if (entries.length !== 50) throw new Error(`Expected 50 wired candidates, got ${entries.length}`);
const rules = [...groups].map(([key, variants]) => {
  const [role, group] = key.split(':');
  return { id: `nature-${role}-${group}`, kind: ['rain', 'leaf-flight', 'leaf-wind', 'splash'].includes(role) ? 'weather-particle' : 'ground-prop', slot: `nature-${role}`, priority: 0,
    conditions: [{ op: 'eq', field: 'role', value: role }, { op: 'eq', field: 'group', value: group }], variants, fallback: 'none' };
});
const path = resolve(root, 'src/render/art/catalog.json');
const catalog = JSON.parse(await readFile(path, 'utf8'));
const updated = [...catalog.filter(bundle => bundle.bundleId !== bundleId), { schemaVersion: 1, bundleId, entries, rules }];
await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
console.log(JSON.stringify({ bundleId, candidates: entries.length, runtimeInstalled: 0 }));
