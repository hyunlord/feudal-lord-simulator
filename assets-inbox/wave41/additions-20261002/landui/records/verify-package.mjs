import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.basename(import.meta.dirname) === 'records' ? path.dirname(import.meta.dirname) : path.join(import.meta.dirname, 'delivery/astra-wave41-landui');
async function walk(dir) {
  const result = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) result.push(...await walk(p));
    else result.push(p);
  }
  return result.sort();
}
const assets = (await walk(root)).filter(p => p.includes('/assets/') && p.endsWith('.png'));
if (assets.length !== 6) throw new Error(`Expected 6 assets, got ${assets.length}`);
const rows = [];
for (const p of assets) {
  const name = path.basename(p);
  const forest = name.includes('woodland');
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 512 || info.height !== (forest ? 64 : 256)) throw new Error(`Canvas: ${name}`);
  let opaque = 0, partial = 0, hiddenRGB = 0;
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4, a = data[i + 3];
    if (a) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    if (a === 255) opaque++;
    if (a > 0 && a < 255) partial++;
    if (a === 0 && (data[i] || data[i + 1] || data[i + 2])) hiddenRGB++;
  }
  let seamMax = 0;
  if (forest) for (let y = 0; y < info.height; y++) for (let c = 0; c < 4; c++) seamMax = Math.max(seamMax, Math.abs(data[y * info.width * 4 + c] - data[((y + 1) * info.width - 1) * 4 + c]));
  if (forest && seamMax !== 0) throw new Error(`X seam: ${name}, max ${seamMax}`);
  if (hiddenRGB) throw new Error(`Transparent RGB: ${name}, ${hiddenRGB}`);
  const sha256 = crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
  rows.push({ id: name.replace(/(?:-v1)?\.png$/, ''), file: path.relative(root, p), status: 'candidate', width: info.width, height: info.height, pivot: forest ? [0, 0] : [256, 128], alphaBounds: [minX, minY, maxX, maxY], opaque, partial, transparent: info.width * info.height - opaque - partial, hiddenRGB, xSeamMax: forest ? seamMax : null, sha256 });
}
const seasonalAlpha = [];
for (const axis of ['ne', 'nw']) {
  const summer = await sharp(path.join(root, `ford/assets/ford_w1_${axis}_summer.png`)).extractChannel('alpha').raw().toBuffer();
  const winter = await sharp(path.join(root, `ford/assets/ford_w1_${axis}_winter.png`)).extractChannel('alpha').raw().toBuffer();
  let different = 0;
  for (let i = 0; i < summer.length; i++) if (summer[i] !== winter[i]) different++;
  if (different) throw new Error(`Seasonal alpha: ${axis}, ${different}`);
  seasonalAlpha.push({ axis, differentPixels: different });
}
await fs.writeFile(path.join(root, 'records/package-QA.json'), JSON.stringify({ kind: 'offline-only', alphaBoundsThreshold: 0, seasonalAlpha, assets: rows }, null, 2) + '\n');
for (const r of rows) {
  const forest = r.id.includes('woodland');
  r.generation_record = forest ? 'forest/records/generations.json' : 'ford/records/generation-' + r.id.replace('ford_w1_', '') + '.json';
  r.references = forest ? 'forest/references' : 'ford/references';
  r.rationale = forest ? 'Soft meadow-to-woodland boundary; new A/B contract' : 'One-tile ford; inherited canvas and pivot; new geometry';
}
const fields = ['id', 'file', 'status', 'width', 'height', 'pivot', 'alphaBounds', 'sha256', 'generation_record', 'references', 'rationale'];
const quote = v => '"' + (typeof v === 'object' ? JSON.stringify(v) : String(v)).replaceAll('"', '""') + '"';
await fs.writeFile(path.join(root, 'assets.csv'), [fields.join(','), ...rows.map(r => fields.map(f => quote(r[f])).join(','))].join('\n') + '\n');
const hashes = [];
for (const p of await walk(root)) {
  if (path.basename(p) === 'SHA256SUMS') continue;
  hashes.push(crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex') + '  ' + path.relative(root, p));
}
await fs.writeFile(path.join(root, 'SHA256SUMS'), hashes.join('\n') + '\n');
console.log(JSON.stringify({ assets: rows, hashedFiles: hashes.length }, null, 2));
