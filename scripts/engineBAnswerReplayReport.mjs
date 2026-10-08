import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const SOURCE = '2485af40046793f1856829fa1161dc4431942aa7';
const YEAR = 4000;
const YEARS = 125;
const END = YEAR * YEARS;
const CATEGORIES = ['classified', 'unclassified', 'excluded', 'unresolved'];
const SCOPES = ['whole', 'registry', 'priorB11'];
const B11 = ['061', '077', '083', '090', '092', '057', '058', '075', '076', '080', '147'].map(id => `ck_evt_${id}`);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function requireValid(condition, message) {
  if (!condition) throw new Error(`Answer replay report rejected: ${message}`);
}
function parse(bytes, label) {
  requireValid(typeof bytes === 'string' || bytes instanceof Uint8Array, `${label} bytes required`);
  const value = JSON.parse(Buffer.from(bytes).toString('utf8'));
  requireValid(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} object required`);
  return value;
}
function counts(rows, key) {
  const result = {};
  for (const row of rows) { const value = row[key] ?? '(unspecified)'; result[value] = (result[value] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
function metrics(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return { total: values.reduce((sum, value) => sum + value, 0), countedYears: values.length,
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    maximum: sorted.at(-1), zeroYears: values.filter(value => value === 0).length,
    aboveFourYears: values.filter(value => value > 4).length };
}
function validateRows(classification, commandCount) {
  requireValid(Array.isArray(classification?.rows), 'classification rows missing');
  const ordinals = new Set();
  const historyIds = new Set();
  for (const row of classification.rows) {
    requireValid(row && CATEGORIES.includes(row.status), 'invalid row status');
    requireValid(Number.isSafeInteger(row.ordinal) && row.ordinal > 0 && row.ordinal <= commandCount && !ordinals.has(row.ordinal), 'invalid or duplicate ordinal');
    ordinals.add(row.ordinal);
    requireValid(Number.isSafeInteger(row.tick) && row.tick >= 0 && row.tick < END, 'row tick outside observed years');
    requireValid(typeof row.command === 'string' && row.command.length > 0, 'row command missing');
    requireValid(row.historyId === null || (typeof row.historyId === 'string' && row.historyId.length > 0 && !historyIds.has(row.historyId)), 'invalid or duplicate history ID');
    if (row.historyId !== null) historyIds.add(row.historyId);
    requireValid(row.status !== 'unresolved', 'unresolved answer evidence');
    if (row.status === 'classified') {
      requireValid(row.historyId !== null && typeof row.source === 'string' && row.source.length > 0
        && typeof row.kind === 'string' && row.kind.length > 0 && Array.isArray(row.weights)
        && row.weights.every(weight => typeof weight === 'string') && typeof row.cameHeavyToLord === 'boolean', 'malformed classified answer');
      requireValid((row.kind === 'registry') === row.source.startsWith('registry:'), 'registry kind/source mismatch');
      if (row.kind === 'registry') requireValid(/^registry:[^:]+:[^:]+$/.test(row.source), 'malformed registry source');
    } else {
      requireValid(row.source === null && row.kind === null && row.weights === null && row.cameHeavyToLord === null, 'unclassified/excluded row has invented classification');
    }
  }
  for (const status of CATEGORIES) requireValid(isDeepStrictEqual(classification[status], classification.rows.filter(row => row.status === status)), `inconsistent ${status} category`);
  return classification.rows;
}
function verifyInput(input) {
  const manifest = parse(input.manifestBytes, 'manifest');
  const validity = parse(input.validityBytes, 'validity');
  const manifestSha256 = sha(input.manifestBytes);
  requireValid(validity.manifestSha256 === manifestSha256, 'manifest SHA mismatch');
  requireValid(validity.valid === true && validity.browserEligible === true && manifest.valid === true && manifest.browserEligible === true, 'replay not verified/eligible');
  requireValid([1, 2, 3].includes(manifest.seed) && manifest.sourceRevision === SOURCE, 'seed or engine source mismatch');
  const source = manifest.source;
  const allowedStatus = new Set(['?? scripts/engineBAnswerEvidence.ts', '?? scripts/engineBAnswerReplay.ts']);
  requireValid(source?.revision === SOURCE && source.platform === 'linux' && source.node === 'v24.21.0'
    && typeof source.status === 'string' && source.status.split('\n').filter(Boolean).every(line => allowedStatus.has(line))
    && hash(source.lock) && source.lock === source.expectedLock, 'source preflight invalid');
  requireValid(hash(manifest.raw?.sha256) && manifest.raw.provenance?.sourceRevision === SOURCE
    && manifest.raw.provenance.dirtyPaths === '' && manifest.raw.provenance.node === 'v24.21.0', 'original raw provenance invalid');
  for (const key of ['manifestSha256', 'contextSha256', 'commandStreamSha256', 'registrySidecarSha256']) requireValid(hash(manifest[key]), `${key} missing`);
  for (const key of ['engineBAnswerReplay.ts', 'engineBAnswerEvidence.ts', 'engineBWeightAuditRun.ts']) requireValid(hash(manifest.toolHashes?.[key]), `tool pin missing: ${key}`);
  requireValid(Number.isSafeInteger(manifest.commandCount) && manifest.commandCount > 0, 'command count invalid');
  requireValid(Array.isArray(manifest.checkpoints) && manifest.checkpoints.every(row => row.hit === true && ['answer', 'consequence'].includes(row.phase))
    && manifest.final?.phase === 'final' && manifest.final.tick === END && manifest.final.hit === true, 'checkpoint verification incomplete');
  const final = manifest.finalComparison;
  requireValid(hash(final?.expectedSha256) && final.expectedSha256 === final.actualSha256
    && typeof final.expectedChecksum === 'string' && final.expectedChecksum.length > 0 && final.expectedChecksum === final.actualChecksum, 'final state mismatch');
  const rows = validateRows(manifest.classification, manifest.commandCount);
  requireValid(Number.isSafeInteger(manifest.registryAnswerSetVerified) && manifest.registryAnswerSetVerified === rows.filter(row => row.status === 'classified' && row.command === 'answer_registry_offer').length, 'registry answer set verification mismatch');
  return { manifest, rows, manifestSha256, validitySha256: sha(input.validityBytes) };
}

/** Inputs are exact manifest/validity bytes, never reconstructed parsed objects. */
export function aggregateAnswerReplays(inputs) {
  requireValid(Array.isArray(inputs) && inputs.length === 3, 'exactly three seed inputs required');
  const verified = inputs.map(verifyInput).sort((a, b) => a.manifest.seed - b.manifest.seed);
  requireValid(isDeepStrictEqual(verified.map(row => row.manifest.seed), [1, 2, 3]), 'duplicate or missing seeds');
  const reference = verified[0].manifest;
  for (const { manifest } of verified) requireValid(isDeepStrictEqual(manifest.toolHashes, reference.toolHashes)
    && manifest.source.lock === reference.source.lock, 'replay tools or dependency pins differ');
  const perSeed = verified.map(({ manifest, rows, manifestSha256, validitySha256 }) => {
    const annual = Array.from({ length: YEARS }, (_, index) => ({ seed: manifest.seed, year: 1300 + index, whole: 0, registry: 0, priorB11: 0 }));
    for (const row of rows) {
      if (row.status !== 'classified' || row.cameHeavyToLord !== true) continue;
      const bucket = annual[Math.floor(row.tick / YEAR)];
      bucket.whole += 1;
      if (row.kind === 'registry') {
        bucket.registry += 1;
        if (B11.includes(row.source.split(':')[1])) bucket.priorB11 += 1;
      }
    }
    return { seed: manifest.seed, provenance: { sourceRevision: SOURCE, manifestSha256, validitySha256,
      rawSha256: manifest.raw.sha256, checkpointManifestSha256: manifest.manifestSha256, contextSha256: manifest.contextSha256,
      commandStreamSha256: manifest.commandStreamSha256, commandCount: manifest.commandCount },
    categories: Object.fromEntries(CATEGORIES.map(status => [status, rows.filter(row => row.status === status).length])),
    unclassifiedByCommand: counts(rows.filter(row => row.status === 'unclassified'), 'command'),
    excludedByReason: counts(rows.filter(row => row.status === 'excluded'), 'reason'),
    annual, metrics: Object.fromEntries(SCOPES.map(scope => [scope, metrics(annual.map(row => row[scope]))])) };
  });
  const annual = perSeed.flatMap(row => row.annual);
  return { sourceRevision: SOURCE, startYear: 1300, endYearExclusive: 1425, endTickExclusive: END, yearsPerSeed: YEARS,
    scope: 'Actual classified command answers under pinned decisionTrace taxonomy, counted at each answer own tick; not root-thread counts.',
    limitations: ['Unknown taxonomy decisions remain unclassified and are excluded from heavy-answer density.',
      'Verified replay eligibility is an input requirement, not proof of rendered UI or overall P-T1 completion.',
      'This report verifies manifest bytes and recorded verification assertions; it does not independently rerun checkpoints or reclassify context files.'],
    priorB11Ids: B11, toolHashes: reference.toolHashes, dependencyLockSha256: reference.source.lock, perSeed,
    categories: Object.fromEntries(CATEGORIES.map(status => [status, perSeed.reduce((sum, seed) => sum + seed.categories[status], 0)])),
    pooled: Object.fromEntries(SCOPES.map(scope => [scope, metrics(annual.map(row => row[scope]))])),
    overFourYears: annual.filter(row => row.whole > 4) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [first, second, third, output, ...extra] = process.argv.slice(2);
  requireValid(first && second && third && output && extra.length === 0, 'usage: node scripts/engineBAnswerReplayReport.mjs seed1Dir seed2Dir seed3Dir output.json');
  const report = aggregateAnswerReplays([first, second, third].map(directory => ({
    manifestBytes: readFileSync(join(directory, 'manifest.json')), validityBytes: readFileSync(join(directory, 'validity.json')),
  })));
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
}
