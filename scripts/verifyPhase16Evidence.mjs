import { readdir, stat, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? 'docs/verification/phase16');
async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesBelow(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}
const files = await filesBelow(root);
const sizes = await Promise.all(files.map(async file => ({ file, bytes: (await stat(file)).size })));
const bytes = sizes.reduce((sum, entry) => sum + entry.bytes, 0);
const problems = [];
if (bytes > 3_000_000) problems.push(`Evidence is ${bytes} bytes; limit is 3000000`);
for (const { file } of sizes) {
  if (!file.endsWith('.md')) continue;
  const text = await readFile(file, 'utf8');
  if (text.includes('/tmp/')) problems.push(`${file}: temporary path cited`);
  const images = [...text.matchAll(/\]\([^)]*\.(?:png|jpe?g)(?:[^)]*)\)/gi)];
  if (images.length > 2) problems.push(`${file}: ${images.length} image links; limit is 2`);
}
console.log(JSON.stringify({ bytes, limit: 3_000_000, files: files.length, problems }, null, 2));
if (problems.length > 0) process.exitCode = 1;
