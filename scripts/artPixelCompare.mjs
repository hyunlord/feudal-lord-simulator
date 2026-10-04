// Run with tsx: uses the repository's dependency-free PNG decoder, never JPEG pixels.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPng } from './processBuildingSprite.ts';

export function compareRgba(left, right) {
  const sameSize = left.dimensions.width === right.dimensions.width && left.dimensions.height === right.dimensions.height;
  const valid = image => [image.dimensions.width, image.dimensions.height].every(value => Number.isSafeInteger(value) && value > 0)
    && image.rgba.length === image.dimensions.width * image.dimensions.height * 4;
  if (!sameSize || !valid(left) || !valid(right)) return { pass: false, sameSize, reason: 'dimensions or RGBA buffer length mismatch' };
  let differingPixels = 0, maxChannelDelta = 0;
  for (let i = 0; i < left.rgba.length; i += 4) {
    let delta = 0;
    for (let channel = 0; channel < 4; channel++) delta = Math.max(delta, Math.abs(left.rgba[i + channel] - right.rgba[i + channel]));
    if (delta) differingPixels++;
    maxChannelDelta = Math.max(maxChannelDelta, delta);
  }
  return { pass: differingPixels === 0, sameSize, ...left.dimensions, differingPixels, maxChannelDelta };
}
export function comparePng(left, right) { return compareRgba(readPng(left), readPng(right)); }

export function compareFolders(before, after) {
  const manifests = [before, after].map(dir => JSON.parse(readFileSync(join(dir, 'captures.json'), 'utf8')));
  const issues = [];
  for (const manifest of manifests) {
    if (manifest.pass !== true || !Array.isArray(manifest.views) || manifest.views.length === 0) issues.push('capture manifest failed or empty');
    if (!Array.isArray(manifest.errors) || manifest.errors.length > 0) issues.push('capture errors missing or nonempty');
    for (const view of manifest.views ?? []) {
      if (!view.identity || typeof view.identity.savedStateSHA !== 'string' || !Array.isArray(view.identity.expectedRequests) || view.identity.expectedRequests.length === 0
        || view.stable !== true || view.repeat?.pass !== true || !Array.isArray(view.errors) || view.errors.length > 0
        || !Array.isArray(view.repeatErrors) || view.repeatErrors.length > 0) issues.push(`${view.name}: incomplete or failed view evidence`);
    }
  }
  const expected = manifests[0].views.map(view => `${view.name}.png`).sort();
  if (new Set(expected).size !== expected.length) issues.push('duplicate view names');
  for (const dir of [before, after]) {
    const files = readdirSync(dir).filter(file => file.endsWith('.png')).sort();
    if (JSON.stringify(files) !== JSON.stringify(expected)) issues.push(`${dir}: PNG file set mismatch`);
    for (const name of expected) if (!readdirSync(dir).includes(name.replace(/\.png$/, '.jpg'))) issues.push(`${dir}: missing context JPEG`);
  }
  const identity = manifest => manifest.views.map(view => ({ name: view.name, identity: view.identity })).sort((a, b) => a.name.localeCompare(b.name));
  if (JSON.stringify(identity(manifests[0])) !== JSON.stringify(identity(manifests[1]))) issues.push('capture identities differ');
  const rows = [];
  if (issues.length === 0) for (const file of expected) rows.push({ file, ...comparePng(join(before, file), join(after, file)) });
  return { pass: issues.length === 0 && rows.every(row => row.pass), issues, rows };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [before, after, ...flags] = process.argv.slice(2);
  try {
    if (!before || !after) throw new Error('Usage: tsx scripts/artPixelCompare.mjs BEFORE AFTER [--out result.json]');
    const result = compareFolders(before, after);
    const index = flags.indexOf('--out');
    if (index >= 0) writeFileSync(flags[index + 1], `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result));
    process.exitCode = result.pass ? 0 : 1;
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
