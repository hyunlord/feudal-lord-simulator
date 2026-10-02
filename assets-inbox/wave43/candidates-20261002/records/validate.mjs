import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';

const root = process.argv[2] ? path.resolve(process.argv[2]) : import.meta.dirname;
const groups = { ground: 8, trees_broadleaf: 3, trees_other: 3, orchard: 4, props: 6 };
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const results = [];
for (const [group, count] of Object.entries(groups)) {
  const rawManifest = JSON.parse(await fs.readFile(path.join(root, group, 'manifest.json')));
  const manifest = Array.isArray(rawManifest) ? rawManifest : rawManifest.assets;
  if (!Array.isArray(manifest) || manifest.length !== count) throw new Error(`${group}: expected ${count} rows`);
  const names = (await fs.readdir(path.join(root, group, 'assets'))).filter(f => f.endsWith('.png'));
  if (names.length !== count) throw new Error(`${group}: unexpected PNG count`);
  for (const row of manifest) {
    if (!Array.isArray(row.pivot) && typeof row.pivot?.x === 'number' && typeof row.pivot?.y === 'number') row.pivot = [row.pivot.x, row.pivot.y];
    const file = row.file ?? row.path;
    if (typeof file !== 'string') throw new Error(`${group}/${row.id}: no file`);
    const source = path.join(root, group, file);
    const bytes = await fs.readFile(source);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== row.width || info.height !== row.height) throw new Error(`Canvas: ${row.id}`);
    if (!Array.isArray(row.pivot) || row.pivot.length !== 2) throw new Error(`Pivot: ${row.id}`);
    let hiddenRGB = 0, nonzero = 0, partial = 0;
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4, a = data[i + 3];
      if (!a && (data[i] || data[i + 1] || data[i + 2])) hiddenRGB++;
      if (a) { nonzero++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      if (a > 0 && a < 255) partial++;
    }
    if (hiddenRGB) throw new Error(`Hidden RGB: ${row.id}, ${hiddenRGB}`);
    let alphaMismatch = null;
    if (group.startsWith('trees') || group === 'orchard') {
      const summer = path.join(root, group, row.summer_reference);
      const base = await sharp(summer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (base.info.width !== info.width || base.info.height !== info.height) throw new Error(`Summer canvas: ${row.id}`);
      alphaMismatch = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== base.data[i]) alphaMismatch++;
      if (alphaMismatch) throw new Error(`Summer alpha: ${row.id}, ${alphaMismatch}`);
    }
    const repeat = String(row.repeat ?? row.tile ?? '').toUpperCase();
    row.repeat = repeat === 'NONE' ? '' : repeat;
    const seam = {};
    if (repeat.includes('X')) {
      let max = 0;
      for (let y = 0; y < info.height; y++) for (let c = 0; c < 4; c++) max = Math.max(max, Math.abs(data[(y * info.width) * 4 + c] - data[(y * info.width + info.width - 1) * 4 + c]));
      seam.x = max;
      if (max) throw new Error(`X seam: ${row.id}, ${max}`);
    }
    if (repeat.includes('Y')) {
      let max = 0;
      for (let x = 0; x < info.width; x++) for (let c = 0; c < 4; c++) max = Math.max(max, Math.abs(data[x * 4 + c] - data[((info.height - 1) * info.width + x) * 4 + c]));
      seam.y = max;
      if (max) throw new Error(`Y seam: ${row.id}, ${max}`);
    }
    const refs = {};
    for (const k of ['summer_reference', 'winter_reference']) if (row[k]) {
      const ref = path.join(root, group, row[k]);
      refs[k] = { file: path.join(group, row[k]), sha256: hash(await fs.readFile(ref)) };
    }
    const record = group === 'ground' || group === 'trees_other' ? `records/${row.id}.json`
      : group === 'trees_broadleaf' ? `records/generation-${row.id.replace('tree_','').replace('_spring','')}.json`
      : group === 'orchard' ? 'records/generations.json' : 'records/provenance.json';
    const provenanceFile = JSON.parse(await fs.readFile(path.join(root, group, record)));
    const provenance = Array.isArray(provenanceFile) ? provenanceFile.find(p=>p.id===row.id || `orchard_${p.species}_spring`===row.id) : provenanceFile;
    if (!provenance || typeof provenance.prompt !== 'string' || provenance.prompt.length < 50) throw new Error(`Full prompt absent: ${row.id}`);
    const recordedSHA=provenance.final_sha256??provenance.output_sha256??provenance.sha256??provenance.final?.sha256;
    if (recordedSHA !== hash(bytes)) throw new Error(`Provenance final SHA mismatch: ${row.id}`);
    results.push({ ...row, file: path.join(group, file), group, status: 'candidate', sha256: hash(bytes), alphaBounds: [x0,y0,x1,y1], alphaMismatch, hiddenRGB, nonzero, partial, seam, references: refs, generation_record: path.join(group,record), prompt:provenance.prompt });
  }
}
if (new Set(results.map(r => r.id)).size !== 24) throw new Error('Duplicate IDs');
await fs.mkdir(path.join(root, 'records'), { recursive: true });
await fs.writeFile(path.join(root, 'records/asset-catalog.json'), JSON.stringify(results, null, 2) + '\n');
await fs.writeFile(path.join(root, 'records/package-QA.json'), JSON.stringify({ total: results.length, offlineOnly: true, treeAndOrchardAlphaExact: results.filter(r => r.alphaMismatch === 0).length, hiddenRGB: results.reduce((n,r) => n+r.hiddenRGB,0), assets: results.map(({id,sha256,seam,alphaMismatch})=>({id,sha256,seam,alphaMismatch})) }, null, 2) + '\n');
const fields = ['id','file','status','width','height','pivot','repeat','summer_reference','winter_reference','note','generation_record','prompt','sha256'];
const q = v => '"'+(v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)).replaceAll('"','""')+'"';
await fs.writeFile(path.join(root,'assets.csv'),[fields.join(','),...results.map(r=>fields.map(f=>q(r[f])).join(','))].join('\n')+'\n');
console.log(JSON.stringify({ total:results.length, exactAlpha:results.filter(r=>r.alphaMismatch===0).length, hiddenRGB:0, seams:'PASS' }));
