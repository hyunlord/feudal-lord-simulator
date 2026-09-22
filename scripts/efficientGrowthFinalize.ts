import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureAcceptance } from './efficientGrowthAcceptance';

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('Expected JSON object');
  return Object.fromEntries(Object.entries(value));
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite number');
  return value;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Expected string');
  return value;
}
const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

function jpegDimensions(bytes: Buffer) {
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 255) throw new TypeError('Invalid JPEG segment');
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) throw new TypeError('Truncated JPEG segment');
    if (marker !== undefined && marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)) {
      if (length < 8) throw new TypeError('Truncated JPEG dimensions');
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += length + 2;
  }
  throw new TypeError('JPEG dimensions missing');
}


/** Capture JSON is browser return data, not a second raw game-state snapshot. */
export function finalizeEfficientGrowth(directory: string, capturePath: string) {
  const stateBytes = readFileSync(resolve(directory, 'final-state.json'));
  const state = record(JSON.parse(stateBytes.toString()));
  const summary = record(JSON.parse(readFileSync(resolve(directory, 'summary.json'), 'utf8')));
  if (summary.finalStateSha256 !== sha256(stateBytes)) throw new Error('Simulation summary does not match final-state.json');
  const captured = record(JSON.parse(readFileSync(capturePath, 'utf8')));
  if (number(captured.tick) !== number(state.tick) || number(captured.seed) !== number(state.seed) ||
    string(captured.stateSha256) !== sha256(stateBytes)) throw new Error('Capture does not match final-state.json');
  const jpeg = string(captured.jpeg);
  if (!jpeg.startsWith('data:image/jpeg;base64,')) throw new TypeError('Expected JPEG data URL');
  const image = Buffer.from(jpeg.slice('data:image/jpeg;base64,'.length), 'base64');
  if (image[0] !== 255 || image[1] !== 216 || image.at(-2) !== 255 || image.at(-1) !== 217) throw new TypeError('Invalid JPEG bytes');
  const dimensions = jpegDimensions(image);
  if (dimensions.width !== number(captured.width) || dimensions.height !== number(captured.height)) {
    throw new Error('JPEG dimensions disagree with capture metadata');
  }
  const filename = 'final.jpg';
  if (existsSync(resolve(directory, filename)) || existsSync(resolve(directory, 'acceptance.json'))) {
    throw new Error('Capture already finalized; preserve existing evidence');
  }
  const capture = { filename, jpegSha256: sha256(image), stateSha256: sha256(stateBytes), captured: true,
    width: number(captured.width), height: number(captured.height), dpr: number(captured.dpr), zoom: number(captured.zoom),
    assetsLoaded: captured.assetsLoaded === true, buildings: number(captured.buildings), warnings: number(captured.warnings) };
  const acceptance = captureAcceptance(capture);
  const passed = summary.simulationPassed === true && acceptance.passed;
  const result = { status: passed ? 'passed' : 'acceptance-unmet', seed: state.seed, source: summary.source,
    simulationPassed: summary.simulationPassed, efficiency: summary.efficiency, capture, captureAcceptance: acceptance,
    camera: captured.camera, visibility: captured.visibility, classification: captured.classification,
    assetFailures: captured.assetFailures, warningIds: captured.warningIds, buildingIds: captured.buildingIds };
  writeFileSync(resolve(directory, filename), image);
  writeFileSync(resolve(directory, 'acceptance.json'), JSON.stringify(result, null, 2));
  return result;
}
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  const capturePath = process.argv[3];
  if (directory === undefined || capturePath === undefined) throw new RangeError('Usage: efficientGrowthFinalize.ts outputDirectory capture-result.json');
  const result = finalizeEfficientGrowth(directory, capturePath);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status !== 'passed') process.exitCode = 1;
}
