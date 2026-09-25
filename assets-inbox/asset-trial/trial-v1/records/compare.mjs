import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp = require('sharp');
const root = path.dirname(fileURLToPath(import.meta.url));
const evidence = path.join(root, 'evidence');
const text = (label, width, height = 44) => Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e0d7c1"/><text x="18" y="29" fill="#302718" font-family="sans-serif" font-size="18">${label}</text></svg>`);
const metrics = [];
for (const variant of ['baseline', 'candidates']) {
  const file = path.join(root, variant, 'grass.png');
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const delta = (a, b) => (Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2])) / 3;
  let horizontal = 0, vertical = 0, inner = 0, count = 0;
  for (let y = 0; y < info.height; y++) horizontal += delta(y * info.width * 3, (y * info.width + info.width - 1) * 3);
  for (let x = 0; x < info.width; x++) vertical += delta(x * 3, ((info.height - 1) * info.width + x) * 3);
  for (let y = 0; y < info.height; y++) for (let x = 1; x < info.width; x++) { inner += delta((y * info.width + x - 1) * 3, (y * info.width + x) * 3); count++; }
  metrics.push({ variant, horizontalJoinMeanRgbDelta: horizontal / info.height, verticalJoinMeanRgbDelta: vertical / info.width, interiorAdjacentMeanRgbDelta: inner / count });
  await sharp({ create: { width: 768, height: 768, channels: 3, background: '#000' } }).composite(Array.from({ length: 9 }, (_, i) => ({ input: file, left: (i % 3) * 256, top: Math.floor(i / 3) * 256 }))).png().toFile(path.join(evidence, variant + '-grass-3x3.png'));
}
await writeFile(path.join(evidence, 'terrain-seams.json'), JSON.stringify(metrics, null, 2));
const panels = [];
for (const [i, variant] of ['baseline', 'candidate'].entries()) {
  panels.push({ input: text(i === 0 ? 'BEFORE - Existing game assets' : 'AFTER - Astra-directed image generation', 960), left: i * 960, top: 0 });
  panels.push({ input: await sharp(path.join(evidence, variant + '-1440.png')).resize(960, 600).toBuffer(), left: i * 960, top: 44 });
}
await sharp({ create: { width: 1920, height: 644, channels: 3, background: '#e0d7c1' } }).composite(panels).png().toFile(path.join(root, 'comparison.png'));
const sprites = [];
for (const [i, variant] of ['baseline', 'candidates'].entries()) {
  sprites.push({ input: text(i === 0 ? 'BEFORE - Existing game assets' : 'AFTER - Astra-directed', 640), left: i * 640, top: 0 });
  for (const [j, file] of ['house_l0.png', 'tree_oak_large.png'].entries()) {
    sprites.push({ input: await sharp(path.join(root, variant, file)).resize({ height: 280, kernel: 'nearest' }).toBuffer(), left: i * 640 + 45 + j * 300, top: 65 });
    sprites.push({ input: await sharp(path.join(root, variant, file)).resize({ height: file === 'house_l0.png' ? 58 : 64 }).toBuffer(), left: i * 640 + 125 + j * 300, top: 375 });
  }
  sprites.push({ input: await sharp(path.join(evidence, variant + '-grass-3x3.png')).resize(600, 600).toBuffer(), left: i * 640 + 20, top: 480 });
}
await sharp({ create: { width: 1280, height: 1100, channels: 3, background: '#e0d7c1' } }).composite(sprites).png().toFile(path.join(root, 'asset-comparison.png'));
console.log(JSON.stringify(metrics));
