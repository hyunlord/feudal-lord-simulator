import { createRequire } from 'node:module';
const require = createRequire('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp = require('sharp');
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const product = '/Users/rexxa/.config/superpowers/worktrees/feudal-lord-simulator/phase14-scale-occlusion-performance';
const specs = [
  { key: 'house', source: 'buildings/house_l0.png', output: 'house_l0.png' },
  { key: 'oak', source: 'foliage/tree_oak_large.png', output: 'tree_oak_large.png' },
  { key: 'grass', source: 'terrain/grass.png', output: 'grass.png' },
];

async function inspect(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1, transparent = 0, opaque = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const alpha = data[(y * info.width + x) * 4 + 3];
    if (alpha === 0) transparent++;
    if (alpha === 255) opaque++;
    if (alpha > 8) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  return { width: info.width, height: info.height, transparent, opaque, bbox: { left, top, width: right - left + 1, height: bottom - top + 1 } };
}

await mkdir(path.join(root, 'candidates'), { recursive: true });
await mkdir(path.join(root, 'baseline'), { recursive: true });
const metrics = [];
for (const spec of specs) {
  const reference = path.join(product, 'public/assets', spec.source);
  const raw = path.join(root, 'raw', spec.key + '.png');
  const baseline = await inspect(reference);
  const generated = await inspect(raw);
  await sharp(reference).png().toFile(path.join(root, 'baseline', spec.output));
  const output = path.join(root, 'candidates', spec.output);
  if (spec.key === 'grass') {
    if (generated.opaque !== generated.width * generated.height) throw new Error('Grass must be opaque');
    await sharp(raw).resize(baseline.width, baseline.height).png().toFile(output);
  } else {
    if (generated.transparent === 0) throw new Error(spec.key + ' has no transparent background');
    const crop = await sharp(raw).extract(generated.bbox).resize(baseline.bbox.width, baseline.bbox.height, { fit: 'inside' }).png().toBuffer();
    const size = await sharp(crop).metadata();
    const left = Math.round(baseline.bbox.left + (baseline.bbox.width - size.width) / 2);
    const top = baseline.bbox.top + baseline.bbox.height - size.height;
    await sharp({ create: { width: baseline.width, height: baseline.height, channels: 4, background: '#00000000' } }).composite([{ input: crop, left, top }]).png().toFile(output);
  }
  metrics.push({ ...spec, baseline, generated, candidate: await inspect(output) });
}
await writeFile(path.join(root, 'evidence/asset-metrics.json'), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics));
