import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = 'assets-inbox/wave43/candidates-20261002';
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const props = json(`${root}/records/props/manifest.json`);
const cherry = json(`${root}/records/orchard/manifest.json`).find(item => item.id === 'orchard_cherry_spring');
const river = json(`${root}/records/ground/riverside_grass_spring_a.json`);
const definitions = [
  ['riverside-grass', 'ground', river, 128], ['cherry', 'orchard', cherry, cherry.worlddisplayWidth],
  ...props.map(item => [{ ewe_lamb_a_spring: 'ewe-lamb', ewe_lamb_b_spring: 'ewe-lamb', swollen_stream_bank_spring: 'swollen-bank', hawthorn_blossom_strip_spring: 'hawthorn', nest_bird_spring: 'nest', laundry_yard_spring: 'laundry' }[item.id], 'props', item, item.suggested_world_width]),
];
function strip(bytes) {
  const chunks = [bytes.subarray(0, 8)];
  for (let offset = 8; offset < bytes.length;) {
    const end = offset + bytes.readUInt32BE(offset) + 12;
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type !== 'caBX') chunks.push(bytes.subarray(offset, end));
    offset = end;
  }
  return Buffer.concat(chunks);
}
const entries = definitions.map(([role, folder, meta, width]) => {
  assert.ok(role); const filename = meta.file.replace('assets/', '');
  const inboxFile = `${root}/assets/${folder}/${filename}`;
  const source = readFileSync(inboxFile); const runtime = strip(source);
  assert.equal(source.readUInt32BE(16), meta.width); assert.equal(source.readUInt32BE(20), meta.height);
  const url = `assets/wave43/${folder}/${filename}`;
  mkdirSync(dirname(`public/${url}`), { recursive: true }); writeFileSync(`public/${url}`, runtime);
  const pivot = Array.isArray(meta.pivot) ? { x: meta.pivot[0], y: meta.pivot[1] } : meta.pivot;
  return { id: `wave43:${meta.id}`, kind: 'ground-prop', placement: 'spring-context', role, group: 'all', season: 'spring', image: { url, width: meta.width, height: meta.height }, provenance: { inboxFile, sourceSha256: sha(source), runtimeSha256: sha(runtime) }, geometry: { pivot, scale: width / meta.width, allowMirror: false }, opacity: 1, minZoom: role === 'nest' ? 1 : 0.6 };
});
const rules = [...new Set(entries.map(entry => entry.role))].map(role => ({ id: `spring-${role}-all`, kind: 'ground-prop', slot: `spring-${role}`, priority: 0, conditions: Object.entries({ placement: 'spring-context', season: 'spring', role, group: 'all' }).map(([field, value]) => ({ op: 'eq', field, value })), variants: entries.filter(entry => entry.role === role).map(entry => ({ assetId: entry.id, weight: 1 })), fallback: 'none' }));
const path = 'src/render/art/catalog.json'; const catalog = json(path).filter(bundle => bundle.bundleId !== 'wave43-spring-context');
catalog.push({ schemaVersion: 1, bundleId: 'wave43-spring-context', entries, rules }); writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Prepared ${entries.length} spring-context assets; only caBX chunks removed.`);
