import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inflateSync } from 'node:zlib';

const work = path.resolve(process.argv[2] ?? '/tmp/astra-wave10-v2-work');
const root = fs.existsSync(path.join(work,'layers')) ? work : path.join(work, 'deliverable');
const raster = path.join(work, 'raster');
const catalog = JSON.parse(fs.readFileSync(path.join(work, 'catalog.json'), 'utf8'));
const assets = new Map(catalog.assets.map((asset) => [asset.id, asset]));
const cache = path.join(work, 'proof-cache');
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(path.join(root, 'composites'), { recursive: true });
const run = (...args) => execFileSync(raster, args.map(String), { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const requireFile = (file) => { if (!fs.existsSync(file)) throw new Error(`Missing required asset: ${file}`); return file; };
const layer = (id) => requireFile(path.join(root, 'layers', `${id}.png`));
const mask = (id, role) => requireFile(path.join(root, 'masks', `${id}_${role}.png`));
const relative = (file) => path.relative(root, file).split(path.sep).join('/');
const pad = (n) => String(n).padStart(2, '0');
const tuckedIds = new Set(['f_01', 'f_02', 'f_03', 'f_07', 'f_08', 'm_01', 'm_03', 'm_08', 'm_09'].map((id) => `pt_hair_${id}`));
const skinPalette = ['#E0BA96', '#CBA07A', '#B38360', '#956846', '#715039'];
const cases = [], clipAudits = [], suites = new Map();
const alphaCache = new Map();
function alpha(file) {
  if (alphaCache.has(file)) return alphaCache.get(file);
  const bytes = fs.readFileSync(file), idat = [];
  let width, height;
  for (let at = 8; at < bytes.length;) {
    const n = bytes.readUInt32BE(at), name = bytes.toString('ascii', at + 4, at + 8), data = bytes.subarray(at + 8, at + 8 + n);
    if (name === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error(`RGBA8 PNG required: ${file}`); }
    if (name === 'IDAT') idat.push(data);
    if (name === 'IEND') break;
    at += n + 12;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * 4, result = Buffer.alloc(width * height);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], row = Buffer.alloc(stride);
    if (filter > 4) throw new Error(`Bad filter: ${file}`);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? row[x - 4] : 0, b = previous[x], c = x >= 4 ? previous[x - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = [0, a, b, Math.floor((a + b) / 2), pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      row[x] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
      if (x % 4 === 3) result[y * width + (x - 3) / 4] = row[x];
    }
    previous = row;
  }
  alphaCache.set(file, result); return result;
}
function clipped(source, hairclip, tag) {
  const target = path.join(cache, `${tag}.png`);
  run('clip-alpha', source, hairclip, target);
  const a = alpha(source), b = alpha(target), m = alpha(hairclip);
  let before = 0, after = 0, changed = 0;
  for (let i = 0; i < a.length; i++) {
    if (m[i] === 0 && a[i] > 0) before++;
    if (m[i] === 0 && b[i] > 0) after++;
    if (a[i] !== b[i]) changed++;
  }
  if (after !== 0) throw new Error(`Hair clipping failed: ${tag}`);
  clipAudits.push({ tag, source: relative(source), mask: relative(hairclip), forbidden_alpha_positive_before: before, forbidden_alpha_positive_after: after, alpha_changed_pixels: changed, scope: 'mask alpha=0 pixels; not a visual halo or protrusion verdict' });
  return target;
}
function compose(suite, number, selection) {
  const child = selection.face.startsWith('pt_face_c_');
  const sizeClass = child ? 'child' : 'adult';
  const c = { ...selection, suite, cell: number, size_class: sizeClass };
  if (suite === '02-combinations') { c.row = Math.floor((number - 1) / 6) + 1; c.column = (number - 1) % 6 + 1; }
  if (suite === '04-random' && child && (c.age || c.beard)) throw new Error('Random child must have no age or beard');
  if (child && c.hair && !c.hair.startsWith('pt_hair_c_')) throw new Error(`Adult hair selected for child: ${c.hair}`);
  if (c.headwear && c.headwear.endsWith('_child') !== child) throw new Error('Headwear size class mismatch');
  if (c.beard && c.beard.endsWith('_child') !== child) throw new Error('Beard size class mismatch');
  if (child && c.beard && (suite !== '02-combinations' || number % 6 !== 0)) throw new Error('Child beard is stress column 6 only');
  const garment = c.garment ?? 'pt_garment_work_tunic';
  const garmentRecord = assets.get(garment);
  if (!garmentRecord) throw new Error(`Garment metadata missing: ${garment}`);
  if (c.headwear?.startsWith('pt_hood') && garmentRecord.collar === 'fur') throw new Error('Hood and fur collar are incompatible');
  c.garment = garment;
  const layers = [];
  let front = null, rear = null;
  if (c.hair) {
    const actual = c.headwear && tuckedIds.has(c.hair) ? `${c.hair}_tucked` : c.hair;
    c.hair_variant = actual;
    front = layer(actual); rear = layer(`${actual}_rear`);
    if (c.grey_child_hair) {
      for (const part of ['front', 'rear']) {
        const source = part === 'front' ? front : rear;
        const suffix = part === 'front' ? '' : '_rear';
        const target = path.join(cache, `${suite}-${number}-grey-${part}.png`);
        run('recolor-skin', source, mask(`${actual}${suffix}`, 'haircolor'), target, '#8B8A83');
        if (part === 'front') front = target; else rear = target;
      }
    }
    if(c.headwear?.startsWith('pt_hat_brim')){const fitted=path.join(cache, `${suite}-${number}-hat-front-tuck.png`);run('place',front,fitted,256,256,0,-6);front=fitted;c.hat_front_tuck_y=-6;}
    if (c.headwear) {
      const hairclip = mask(c.headwear, 'hairclip');
      front = clipped(front, hairclip, `${suite}-${number}-front`);
      rear = clipped(rear, hairclip, `${suite}-${number}-rear`);
    }
    layers.push(rear);
  }
  let faceLayer = layer(c.face);
  if (c.skin_tone) {
    if (suite !== '04-random' || !skinPalette.includes(c.skin_tone)) throw new Error('Skin-tone variants must use the random proof palette');
    const tinted = path.join(cache, `${suite}-${number}-skin.png`);
    run('recolor-skin', faceLayer, mask(c.face, 'skinmask'), tinted, c.skin_tone);
    faceLayer = tinted;
    c.skin_processing = { target: c.skin_tone, face_mask: relative(mask(c.face, 'skinmask')), age_mask: c.age ? relative(mask(c.age, 'skinmask')) : null, method: 'native recolor-skin; same target for face and age; source assets unchanged' };
  }
  let garmentLayer=layer(garment);if(child){garmentLayer=path.join(cache, `${suite}-${number}-child-collar.png`);run('warp',layer(garment),garmentLayer,path.join(work,'child-collar-fit.json'));c.collar_processing='central collar raised14px; outer shoulder pixels preserved via yFadeX45,80,175,210';}layers.push(garmentLayer, faceLayer);
  if (c.age) {
    let age = layer(c.age);
    if (c.skin_tone) {
      const tinted = path.join(cache, `${suite}-${number}-age-skin.png`);
      run('recolor-skin', age, mask(c.age, 'skinmask'), tinted, c.skin_tone);
      age = tinted;
    }
    if (child) {
      if (suite !== '02-combinations' || number % 6 !== 5) throw new Error('Child age is stress column 5 only');
      const transformed = path.join(cache, `${suite}-${number}-child-age.png`);
      run('warp', age, transformed, requireFile(path.join(work, 'child-registration.json')));
      age = transformed;
    }
    layers.push(age);
  }
  if (front) layers.push(front);
  if (c.beard && c.beard !== 'pt_beard_09') layers.push(layer(c.beard));
  if (c.headwear) layers.push(layer(c.headwear));
  const target = path.join(root, 'composites', `${suite}-${pad(number)}.png`);
  run('composite', target, ...layers);
  c.file = relative(target); c.composite_order = layers.map(relative);
  cases.push(c);
  if (!suites.has(suite)) suites.set(suite, []);
  suites.get(suite).push({ file: target, label: `${pad(number)} ${c.face.replace('pt_face_', '')}${c.age ? ' +age' : ''}${c.headwear ? ' +cover' : ''}` });
  return target;
}
function board(suite, items, columns, size, background = '#E8E2D4', suffix = '') {
  const directory = path.join(root, 'checks', suite); fs.mkdirSync(directory, { recursive: true });
  const margin = 16, gap = 10, labelHeight = 25, titleHeight = 38;
  const width = margin * 2 + columns * (size + gap) - gap;
  const height = titleHeight + margin + Math.ceil(items.length / columns) * (size + labelHeight + gap);
  const bright = background === '#202020';
  const scene = { width, height, background, images: [], texts: [{ text: `${suite} | ${size}px | ${items.length} cells${suffix ? ` | ${suffix}` : ''}`, x: margin, y: 10, size: 15, color: bright ? '#E8E2D4' : '#202020' }] };
  items.forEach((item, i) => {
    const x = margin + i % columns * (size + gap), y = titleHeight + Math.floor(i / columns) * (size + labelHeight + gap);
    scene.images.push({ file: item.file, x, y, width: size, height: size });
    scene.texts.push({ text: item.label, x, y: y + size + 3, size: size === 96 ? 9 : 12, color: bright ? '#E8E2D4' : '#202020' });
  });
  const scenePath = path.join(cache, `${suite}-${suffix || 'normal'}-${size}.json`); save(scenePath, scene);
  const target = path.join(directory, `${suffix ? `${suffix}-` : ''}${size}.png`);
  run('board', target, scenePath);
  return { path: relative(target), size, ...(suffix ? { background: suffix } : {}) };
}

const faceIds = ['m', 'f', 'c'].flatMap((sex) => Array.from({ length: sex === 'c' ? 4 : 8 }, (_, i) => `pt_face_${sex}_${pad(i + 1)}`));
for (const [i, id] of faceIds.entries()) {
  const asset = assets.get(id); if (!asset?.anchors) throw new Error(`Missing anchors: ${id}`);
  const a = asset.anchors, regions = [];
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  for (const [x, y] of [a.crown, a.hairline, a.ear, a.chin]) { regions.push(rect(x - 4, y, 9, 1)); regions.push(rect(x, y - 4, 1, 9)); }
  for (const y of [a.eye_line_y, a.shoulder_y]) regions.push(rect(48, y, 132, 1));
  const guide = path.join(cache, `${id}-guide.png`), specification = path.join(cache, `${id}-guide.json`);
  save(specification, { width: 256, height: 256, regions }); run('polygon-mask', guide, specification);
  const target = path.join(root, 'composites', `01-faces-${pad(i + 1)}.png`); run('composite', target, layer(id), guide);
  if (!suites.has('01-faces')) suites.set('01-faces', []);
  suites.get('01-faces').push({ file: target, label: `${pad(i + 1)} ${id.replace('pt_face_', '')} 6 declared anchors` });
  cases.push({ suite: '01-faces', cell: i + 1, face: id, file: relative(target), guides: a, note: 'marks show declared targets, not measured landmarks' });
}
const rows = ['f_01', 'f_05', 'm_01', 'm_05', 'c_01', 'c_03'];
rows.forEach((face, row) => {
  const child = face.startsWith('c'), female = face.startsWith('f'), suffix = child ? '_child' : '';
  const long = child ? 'pt_hair_c_05' : female ? 'pt_hair_f_03' : 'pt_hair_m_03';
  const short = child ? 'pt_hair_c_01' : female ? 'pt_hair_f_06' : 'pt_hair_m_02';
  const grey = child ? 'pt_hair_c_06' : female ? 'pt_hair_f_07' : 'pt_hair_m_07';
  const selections = [{}, { hair: long }, { hair: long, headwear: `pt_hood${suffix}` }, { hair: short, headwear: `pt_hat_brim${suffix}` }, { hair: grey, age: `pt_age_${female ? 'f' : 'm'}_old_a`, grey_child_hair: child }, { hair: short, beard: `pt_beard_01${suffix}`, headwear: `pt_hood${suffix}`, test_only: child }];
  selections.forEach((selection, col) => compose('02-combinations', row * 6 + col + 1, { face: `pt_face_${face}`, ...selection }));
});
['m_01', 'm_05', 'f_01', 'f_05'].forEach((face, i) => {
  const sex = face[0], hair = `pt_hair_${sex}_07`;
  compose('03-aging', i * 2 + 1, { face: `pt_face_${face}`, hair, comparison: 'before' });
  compose('03-aging', i * 2 + 2, { face: `pt_face_${face}`, hair, age: `pt_age_${sex}_old_${i % 2 ? 'b' : 'a'}`, comparison: 'after' });
});
let seed = 100926;
const random = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
const visibleKeys=new Set();
for (let i = 0; i < 48; i++) {
  const face = faceIds[(i * 7 + Math.floor(i / 20)) % faceIds.length], child = face.includes('_c_'), female = face.includes('_f_');
  const hair = child ? `pt_hair_c_${pad(random(6) + 1)}` : `pt_hair_${female ? 'f' : 'm'}_${pad(random(9) + 1)}`;
  const coverChoice = random(3); let headwear = coverChoice === 0 ? null : `${coverChoice === 1 ? 'pt_hood' : 'pt_hat_brim'}${child ? '_child' : ''}`;
  const age = !child && random(3) === 0 ? `pt_age_${female ? 'f' : 'm'}_${random(2) ? 'old' : 'mature'}_${random(2) ? 'a' : 'b'}` : null;
  const beardIndex = random(10) + 1;
  const beard = !child && !female && beardIndex !== 9 ? `pt_beard_${pad(beardIndex)}` : null;
  const garment = !headwear?.startsWith('pt_hood') && random(2) ? 'pt_garment_merchant_gown' : 'pt_garment_work_tunic';
  const visibleKey=JSON.stringify([face,headwear,Boolean(age),beard,headwear?null:hair]);const duplicateCover=Boolean(headwear&&visibleKeys.has(visibleKey));visibleKeys.add(visibleKey);if(duplicateCover)headwear=null;
  const toneIndex = (i * 3 + 1) % skinPalette.length;
  compose('04-random', i + 1, { face, hair, headwear, age, beard, garment, duplicate_cover_removed:duplicateCover, seed: 100926, skin_tone_index: toneIndex, skin_tone: skinPalette[toneIndex] });
}
const proofs = [];
for (const [suite, columns] of [['01-faces', 5], ['02-combinations', 6], ['03-aging', 4], ['04-random', 8]]) proofs.push({ id: suite, files: [256, 96].map((size) => board(suite, suites.get(suite), columns, size)) });
const edgeItems = suites.get('02-combinations');
const edgeFiles = [];
for (const [background, color] of [['dark', '#202020'], ['light', '#E8E2D4']]) for (const size of [256, 96]) edgeFiles.push(board('05-edges', edgeItems, 6, size, color, background));
proofs.push({ id: '05-edges', files: edgeFiles });
save(path.join(root, 'composition-cases.json'), { seed: 100926, cases, clip_audits: clipAudits, policy: { child_random_no_age_or_beard: true, child_beard_stress_only: true, forbid_hood_fur: true, hairclip_front_and_rear: true, random_skin_palette: skinPalette, skin_palette_selection: '(zero_based_cell * 3 + 1) % 5; independent of garment, status, gender and moral labels', face_age_same_skin_target: true, uniform_base_assets_unchanged: true }, note: 'Selector and clipping evidence only. Visual 36/48 defect counts require separate inspection.' });
save(path.join(work, 'proofs-catalog.json'), proofs);
console.log(JSON.stringify({ proofs: proofs.length, proof_pngs: proofs.flatMap((proof) => proof.files).length, cases: cases.length, clipping_checks: clipAudits.length, forbidden_alpha_positive_after: clipAudits.reduce((sum, item) => sum + item.forbidden_alpha_positive_after, 0) }, null, 2));
