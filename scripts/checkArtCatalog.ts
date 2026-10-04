import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { readPng } from './processBuildingSprite';
import { decodePng } from './keyartDerivatives';

export type CatalogFileCheck = {
  readonly id: string;
  readonly source: string;
  readonly runtime: string;
  readonly sourceSha256: string | null;
  readonly runtimeSha256: string | null;
  readonly samePixels: boolean;
  readonly errors: readonly string[];
};
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

class CatalogImageError extends Error {
  constructor(message: string) { super(message); this.name = 'CatalogImageError'; }
}

function imageFormat(bytes: Buffer): 'png' | 'jpeg' {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  throw new CatalogImageError('Unsupported image magic: expected PNG or JPEG');
}

function readImage(path: string, bytes: Buffer) {
  if (imageFormat(bytes) === 'png') return readPng(path);
  if (bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new CatalogImageError('Truncated JPEG: missing end marker');
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-xerror', '-err_detect', 'explode',
    '-threads', '1', '-f', 'mjpeg', '-i', 'pipe:0', '-frames:v', '1', '-threads', '1',
    '-f', 'image2pipe', '-vcodec', 'png', '-pix_fmt', 'rgba', 'pipe:1'],
  { input: bytes, timeout: 15_000, maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0 || result.stderr.length > 0) {
    throw new CatalogImageError(`JPEG decode failed: ${result.error?.message ?? result.stderr.toString('utf8').slice(0, 1000)}`);
  }
  const decoded = decodePng(result.stdout);
  return { dimensions: { width: decoded.width, height: decoded.height }, rgba: decoded.data };
}

function inside(root: string, file: string): string {
  const absolute = realpathSync(resolve(root, file));
  const path = relative(realpathSync(root), absolute);
  if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) throw new Error(`Asset escapes repository: ${file}`);
  return absolute;
}

/** Offline provenance and lossless installation check; this does not establish runtime selection or visibility. */
export function checkCatalogFiles(root: string, bundles: readonly unknown[]): readonly CatalogFileCheck[] {
  const registry = createArtRegistry(bundles);
  return registry.entries().map(entry => {
    const errors: string[] = [];
    const source = entry.provenance.inboxFile;
    const runtime = `public/${entry.image.url.replace(/^\//, '')}`;
    let sourceSha256: string | null = null;
    let runtimeSha256: string | null = null;
    let samePixels = false;
    try {
      const sourcePath = inside(root, source);
      const runtimePath = inside(root, runtime);
      const sourceBytes = readFileSync(sourcePath);
      const runtimeBytes = readFileSync(runtimePath);
      sourceSha256 = sha(sourceBytes);
      runtimeSha256 = sha(runtimeBytes);
      if (sourceSha256 !== entry.provenance.sourceSha256) errors.push('Source SHA differs from contract');
      if (runtimeSha256 !== entry.provenance.runtimeSha256) errors.push('Runtime SHA differs from contract');
      const sourceFormat = imageFormat(sourceBytes);
      const runtimeFormat = imageFormat(runtimeBytes);
      if (sourceFormat !== runtimeFormat) errors.push('Runtime image format differs from approved source');
      if ((sourceFormat === 'jpeg' || runtimeFormat === 'jpeg') && !sourceBytes.equals(runtimeBytes)) errors.push('JPEG installation must preserve approved bytes');
      const original = readImage(sourcePath, sourceBytes);
      const installed = readImage(runtimePath, runtimeBytes);
      if (installed.dimensions.width !== entry.image.width || installed.dimensions.height !== entry.image.height) errors.push('Runtime dimensions differ from contract');
      samePixels = original.dimensions.width === installed.dimensions.width
        && original.dimensions.height === installed.dimensions.height
        && Buffer.from(original.rgba).equals(Buffer.from(installed.rgba));
      if (!samePixels) errors.push('Installed pixels differ from approved source');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    return { id: entry.id, source, runtime, sourceSha256, runtimeSha256, samePixels, errors };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const catalogPath = process.argv[2] ?? 'src/render/art/catalog.json';
  const data: unknown = JSON.parse(readFileSync(catalogPath, 'utf8'));
  if (!Array.isArray(data)) throw new Error('Catalog must be an array of complete bundles');
  const rows = checkCatalogFiles(process.cwd(), data);
  const result = { pass: rows.every(row => row.errors.length === 0), count: rows.length,
    scope: 'Offline source/runtime SHA, dimensions and decoded RGBA only; not runtime installation evidence', rows };
  if (process.argv[3]) writeFileSync(process.argv[3], `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ pass: result.pass, count: result.count, errors: rows.filter(row => row.errors.length) }));
  process.exitCode = result.pass ? 0 : 1;
}
