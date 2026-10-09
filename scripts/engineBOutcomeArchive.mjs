import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const outcomeSha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function requireOutcome(condition, message) {
  if (!condition) throw new Error(`Outcome evidence rejected: ${message}`);
}
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const identity = value => typeof value === 'string' && value.length > 0;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const parse = (bytes, name) => {
  requireOutcome(bytes instanceof Uint8Array, `${name} bytes missing`);
  const value = JSON.parse(Buffer.from(bytes).toString('utf8'));
  requireOutcome(value && typeof value === 'object' && !Array.isArray(value), `${name} object missing`);
  return value;
};
function uniqueMap(rows, name) {
  requireOutcome(Array.isArray(rows), `${name} array missing`);
  const map = new Map();
  for (const row of rows) {
    requireOutcome(row && identity(row.id) && !map.has(row.id), `${name} duplicate/invalid ID`);
    map.set(row.id, row);
  }
  return map;
}

/** Verifies existing replay/archive bytes, without executing an engine or trusting cached aggregate counts. */
export function verifyOutcomeReplay(input) {
  requireOutcome(['answer-replay-v1', 'outcome-replay-v1'].includes(input.format), 'explicit replay format required');
  const raw = parse(input.rawBytes, 'raw');
  const manifest = parse(input.manifestBytes, 'manifest');
  const validity = parse(input.validityBytes, 'validity');
  const classification = parse(input.classificationBytes, 'classification');
  const sourceRevision = raw.provenance?.sourceRevision;
  requireOutcome(typeof sourceRevision === 'string' && /^[a-f0-9]{40}$/.test(sourceRevision), 'source revision invalid');
  requireOutcome(raw.provenance.dirtyPaths === '', 'dirty original engine');
  requireOutcome(manifest.sourceRevision === sourceRevision && manifest.source?.revision === sourceRevision
    && isDeepStrictEqual(manifest.raw?.provenance, raw.provenance), 'source provenance mismatch');
  requireOutcome(/^v\d+\.\d+\.\d+$/.test(manifest.source.node ?? '') && manifest.source.platform === 'linux'
    && raw.provenance.node === manifest.source.node, 'runtime provenance mismatch');
  if (raw.provenance.sourceFiles !== undefined) {
    requireOutcome(Array.isArray(raw.provenance.sourceFiles) && raw.provenance.sourceFiles.length > 0
      && new Set(raw.provenance.sourceFiles.map(row => row.path)).size === raw.provenance.sourceFiles.length
      && raw.provenance.sourceFiles.every(row => identity(row.path) && hash(row.sha256)), 'product source pins invalid');
  }
  requireOutcome(manifest.source.lock === manifest.source.expectedLock && hash(manifest.source.lock), 'dependency pin mismatch');
  const allowed = new Set(['?? scripts/engineBAnswerReplay.ts', '?? scripts/engineBAnswerEvidence.ts']);
  requireOutcome(typeof manifest.source.status === 'string' && manifest.source.status.split('\n').filter(Boolean).every(row => input.format === 'answer-replay-v1' && allowed.has(row) && hash(manifest.toolHashes?.[row.slice('?? scripts/'.length)])), 'unaccounted replay source changes');
  requireOutcome(manifest.toolHashes && Object.keys(manifest.toolHashes).length > 0 && Object.values(manifest.toolHashes).every(hash), 'tool hashes missing');
  requireOutcome(validity.manifestSha256 === outcomeSha256(input.manifestBytes), 'manifest hash mismatch');
  requireOutcome(manifest.raw.sha256 === outcomeSha256(input.rawBytes), 'raw hash mismatch');
  requireOutcome(validity.valid === true && manifest.valid === true && (input.format === 'answer-replay-v1'
    ? validity.browserEligible === true && manifest.browserEligible === true
    : manifest.replayFormat === input.format && manifest.replayVerified === true && manifest.browserEligible === false && validity.browserEligible === false), 'replay verification missing');
  requireOutcome(Number.isSafeInteger(raw.seed) && raw.seed >= 1 && raw.seed === manifest.seed, 'seed mismatch');
  requireOutcome(raw.years === 125 && integer(raw.startYear) && raw.endYearExclusive === raw.startYear + raw.years
    && integer(raw.endTick) && raw.endTick > 0, '125-year interval invalid');
  const observation = raw.observation;
  requireOutcome(observation?.firstTick === 0 && observation.lastTick === raw.endTick && observation.maxGap === 1 && observation.reversals === 0, 'incomplete observation');
  requireOutcome(Array.isArray(manifest.checkpoints) && manifest.checkpoints.every(row => row.hit === true)
    && manifest.final?.hit === true && manifest.final.phase === 'final' && manifest.final.tick === raw.endTick, 'checkpoint/final verification incomplete');
  const final = manifest.finalComparison;
  requireOutcome(hash(final?.expectedSha256) && final.expectedSha256 === final.actualSha256
    && identity(final.expectedChecksum) && final.expectedChecksum === final.actualChecksum, 'final comparison mismatch');
  requireOutcome(isDeepStrictEqual(manifest.classification, classification), 'classification archive mismatch');
  requireOutcome(Array.isArray(classification.rows) && integer(manifest.commandCount) && classification.rows.length === manifest.commandCount, 'classification rows missing');
  const history = uniqueMap(raw.history, 'history');
  const roots = uniqueMap(raw.decisions, 'decisions');
  const occurrences = uniqueMap(raw.occurrences, 'occurrences');
  for (const row of history.values()) {
    requireOutcome(integer(row.tick) && row.tick <= raw.endTick && identity(row.kind), 'history time/kind invalid');
    requireOutcome(row.because === undefined || (Array.isArray(row.because) && row.because.every(cause => identity(cause.decisionId) && identity(cause.key))), 'invalid because');
  }
  const ordinals = new Set(), ids = new Set();
  const statuses = ['classified', 'excluded', 'unclassified', 'unresolved'];
  for (const row of classification.rows) {
    requireOutcome(statuses.includes(row.status) && row.status !== 'unresolved', 'invalid/unresolved classification');
    requireOutcome(integer(row.ordinal) && row.ordinal > 0 && row.ordinal <= manifest.commandCount && !ordinals.has(row.ordinal), 'duplicate/invalid ordinal');
    ordinals.add(row.ordinal);
    requireOutcome(integer(row.tick) && row.tick < raw.endTick && identity(row.command), 'invalid answer tick/command');
    requireOutcome(row.historyId === null || (identity(row.historyId) && !ids.has(row.historyId)), 'duplicate/invalid answer history ID');
    if (row.historyId !== null) {
      ids.add(row.historyId);
      const decision = history.get(row.historyId);
      requireOutcome(decision?.kind === 'decision' && decision.tick === row.tick
        && (decision.params?.command === undefined || decision.params.command === row.command), 'answer/history join missing');
    }
    if (row.status === 'classified') {
      requireOutcome(identity(row.historyId) && identity(row.source) && identity(row.kind) && Array.isArray(row.weights)
        && row.weights.every(identity) && typeof row.cameHeavyToLord === 'boolean', 'classified evidence malformed');
      requireOutcome((row.kind === 'registry') === row.source.startsWith('registry:'), 'registry source/kind mismatch');
      if (row.kind === 'registry') requireOutcome(/^registry:[^:]+:[^:]+$/.test(row.source), 'registry source malformed');
    } else requireOutcome(row.source === null && row.kind === null && row.weights === null && row.cameHeavyToLord === null, 'invented classification');
  }
  for (const record of history.values()) {
    if (record.kind === 'decision' && record.tick < raw.endTick && identity(record.params?.command))
      requireOutcome(ids.has(record.id), 'raw command decision omitted from classification');
  }
  for (const status of statuses) requireOutcome(isDeepStrictEqual(classification[status], classification.rows.filter(row => row.status === status)), `classification ${status} inconsistent`);
  requireOutcome(manifest.registryAnswerSetVerified === classification.rows.filter(row => row.status === 'classified' && row.command === 'answer_registry_offer').length, 'registry answer verification mismatch');
  return { raw, manifest, classification, history, roots, occurrences, pins: { seed: raw.seed, sourceRevision, replayFormat: input.format, node: manifest.source.node, dependencyLockSha256: manifest.source.lock,
    rawSha256: outcomeSha256(input.rawBytes), replayManifestSha256: outcomeSha256(input.manifestBytes),
    validitySha256: outcomeSha256(input.validityBytes), classificationSha256: outcomeSha256(input.classificationBytes) } };
}
