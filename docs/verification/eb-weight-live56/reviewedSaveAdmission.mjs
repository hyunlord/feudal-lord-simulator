import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeSave as officialDecodeSave } from '../../../src/save/saveCodec.ts';

// v55ToV56 changes only envelope.schemaVersion. Never infer optional new facts for old saves.
export const saveAdmissions = [];
export function decodeSave(bytes) {
  const raw = JSON.parse(Buffer.from(bytes).toString('utf8'));
  const decoded = officialDecodeSave(bytes);
  const before = raw.state, after = decoded.envelope.state;
  const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const differences = [];
  function compare(a, b, path) {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) compare(a[key], b[key], [...path, key]);
    } else differences.push({ path, beforePresent: a !== undefined, afterPresent: b !== undefined, before: a ?? null, after: b ?? null });
  }
  compare(before, after, []);
  const admission = { originalSchema: raw.schemaVersion, migratedFrom: decoded.migratedFrom,
    currentSchema: decoded.envelope.schemaVersion, originalStateSha256: sha(before), migratedStateSha256: sha(after),
    stateDifferences: differences,
    envelopeSchemaChange: raw.schemaVersion === decoded.envelope.schemaVersion ? null : { before: raw.schemaVersion, after: decoded.envelope.schemaVersion },
    source: 'official decodeSave; v55ToV56 is version-only; any state difference remains rejected' };
  saveAdmissions.push(admission);
  assert.deepEqual(after, before, 'Official migration changed state; separate source review required');
  assert.equal(admission.migratedStateSha256, admission.originalStateSha256, 'State serialization changed during admission');
  return decoded;
}
