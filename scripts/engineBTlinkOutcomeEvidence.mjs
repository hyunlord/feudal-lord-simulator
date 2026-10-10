import { INERT_REVIEWED_EFFECT_SOURCES } from './engineBInertReviewedSources.mjs';
import { isDeepStrictEqual } from 'node:util';

export const TLINK_REVIEWED_EFFECT_SOURCES = [
  { path: 'src/engine/registryV4.ts', sha256: 'a2f9b9fc60e0281d5bce348d644da012a2c51f533f94f17f1170d64d939481bf' },
  { path: 'src/engine/estateSuits.ts', sha256: '79ae19be3060a587241a80e0d966ad38a83a47f9aa2fdc8bee7d751df3c04779' },
  { path: 'src/content/stewardshipConfig.ts', sha256: 'aa01e8e7a7929122d75cd26fadce98459d86ff2893eec57a64ea8a03533e5949' },
  { path: 'src/engine/estates.ts', sha256: 'd592e9373961ed2b23780c83376dc00b78cea69b6c411732ea476629677e1c2e' },
  { path: 'src/ledger/ledger.ts', sha256: 'e2bfed958ef4dcf195527d03a29f0cb4093a63c4382e19c944ba7b2251064304' },
  { path: 'src/engine/timberTrade.ts', sha256: '0983dcbf2ba146f186845e3f22bc6c764162c2b90c5d7b69ab14e6f8972905ca' },
  { path: 'src/state/gameStore.ts', sha256: '4f965e306b793c443edbf384d8228b487fec028020529c6a675c0ead91e28d12' },
  { path: 'src/engine/stewardship.ts', sha256: '0ee5cbc4f8024c035915cae2f74a40e5db3eccaeab21ec13ecfc061ecf0bcff4' },
  { path: 'src/engine/history.ts', sha256: '133037b55d3c0c0c9f9147f0799053a47d0de7c07a5ddc8a28c8971172087429' },
  { path: 'src/engine/decisionTrace.ts', sha256: 'b7fbe5a704a1c2398e8a12ed0bac62202e3dc498bd55eb7d777aa6bc8f5f26a9' },
  { path: 'src/engine/factions.ts', sha256: '66bf718a318d1cd965e49a806ca8b2f13a3a61669eb8cf4630b0a9e23c40bf36' },
  { path: 'src/engine/townAgency.ts', sha256: '6544b913535b63385da3b3c8f59db243d41c3a2231d00ff9150740407ec886a3' },
];
const key = path => JSON.stringify(path);
const at = (state, path) => path.reduce((value, part) => value != null && Object.hasOwn(value, part) ? value[part] : undefined, state);
const prefix = (path, base) => base.every((part, index) => path[index] === part);
const numeric = value => typeof value === 'number' && Number.isFinite(value);
function pairedIndex(row, base, field, id) {
  const before = at(row.before, base), after = at(row.after, base);
  if (!Array.isArray(before) || !Array.isArray(after) || typeof id !== 'string' || !id) return null;
  const old = before.map((item, index) => item?.[field] === id ? index : -1).filter(index => index >= 0);
  const current = after.map((item, index) => item?.[field] === id ? index : -1).filter(index => index >= 0);
  return old.length === 1 && current.length === 1 && old[0] === current[0] ? [...base, String(old[0])] : null;
}
function stableItem(row, path, field) {
  const old = at(row.before, path), current = at(row.after, path);
  return old && current && typeof old[field] === 'string' && old[field] === current[field]
    && pairedIndex(row, path.slice(0, -1), field, old[field]) !== null;
}
function effect(row, path, kind) {
  const before = at(row.before, path), after = at(row.after, path);
  return { path, kind, beforePresent: before !== undefined, afterPresent: after !== undefined,
    before: before === undefined ? null : before, after: after === undefined ? null : after };
}

// These scalar values are actual game state, not counts of having processed an answer.
function scalarKind(row, path) {
  const old = at(row.before, path), current = at(row.after, path);
  if (path.length === 1 && path[0] === 'timberOrder' && (old === undefined || numeric(old)) && (current === undefined || numeric(current))
    && (numeric(old) || numeric(current)) && (old ?? 0) !== (current ?? 0)) return 'command-state';
  if (path.length === 1 && path[0] === 'treasuryCoin' && numeric(old) && numeric(current)) return 'money';
  if (path.length === 4 && prefix(path, ['estates', 'claims']) && path[3] === 'strength'
    && stableItem(row, path.slice(0, 3), 'id') && numeric(old) && numeric(current)) return 'rights';
  if (path.length === 4 && prefix(path, ['factions', 'factions']) && path[3] === 'relation'
    && stableItem(row, path.slice(0, 3), 'id') && numeric(old) && numeric(current)) return 'relation';
  if (path.length === 4 && prefix(path, ['stewardship', 'oversight']) && ['tenants', 'merchants'].includes(path[3])
    && stableItem(row, path.slice(0, 3), 'estateId') && numeric(old) && numeric(current)) return 'relation';
  if (path.length === 4 && prefix(path, ['stewardship', 'stewards']) && path[3] === 'loyalty'
    && stableItem(row, path.slice(0, 3), 'personId') && numeric(old) && numeric(current)) return 'relation';
  if (path.length === 4 && prefix(path, ['stewardship', 'oversight']) && stableItem(row, path.slice(0, 3), 'estateId')
    && ((path[3] === 'mode' && ['direct', 'steward'].includes(old) && ['direct', 'steward'].includes(current))
      || (path[3] === 'auditMode' && ['accounts', 'visit'].includes(old) && ['accounts', 'visit'].includes(current)))) return 'command-state';
  if (path.length === 4 && prefix(path, ['stewardship', 'stewards']) && path[3] === 'status'
    && stableItem(row, path.slice(0, 3), 'personId') && ['candidate', 'serving', 'dismissed', 'dead'].includes(old)
    && ['candidate', 'serving', 'dismissed', 'dead'].includes(current)) return 'person';
  if (path.length === 4 && prefix(path, ['stewardship', 'oversight']) && path[3] === 'stewardId'
    && stableItem(row, path.slice(0, 3), 'estateId') && typeof old === 'string' && typeof current === 'string') return 'person';
  if (path.length === 2 && path[0] === 'agency' && path[1] === 'duesPermille' && numeric(old) && numeric(current)) return 'rights';
  if (path.length === 2 && path[0] === 'agency' && path[1] === 'policy' && typeof old === 'string' && typeof current === 'string') return 'command-state';
  if (path.length === 3 && prefix(path, ['stewardship', 'standing'])
    && (old === undefined || ['customary', 'lenient', 'strict', 'lord'].includes(old))
    && (current === undefined || ['customary', 'lenient', 'strict', 'lord'].includes(current))
    && (old ?? 'customary') !== (current ?? 'customary')) {
    const auditKey = path[2].startsWith('audit:');
    const stewards = row.after.stewardship?.stewards ?? [];
    if (!auditKey || stewards.some(steward => path[2] === `audit:${steward.estateId}:${steward.personId}`)) return 'command-state';
  }
  return null;
}

// New optional policy containers arrive as one delta; inspect every leaf so unknown writes remain visible.
function policyDeltaPaths(row, path) {
  const policy = prefix(path, ['stewardship', 'standing'])
    || path.length >= 4 && prefix(path, ['stewardship', 'stewards']) && path[3] === 'auditTolerance';
  if (!policy) return [path];
  const before = at(row.before, path), after = at(row.after, path);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(before) && !object(after)) return [path];
  const keys = [...new Set([...Object.keys(object(before) ? before : {}), ...Object.keys(object(after) ? after : {})])];
  return keys.filter(field => !isDeepStrictEqual(before?.[field], after?.[field])).flatMap(field => policyDeltaPaths(row, [...path, field]));
}

function reviewedScope(row, inertProfile) {
  const paths = new Map(), bookkeeping = [], add = (path, kind) => paths.set(key(path), { path, kind });
  let complete = false, review = 'unsupported_command_or_target';
  if (row.command.type === 'answer_estate_petition') {
    const base = pairedIndex(row, ['stewardship', 'petitions'], 'id', row.command.petitionId);
    const before = base && at(row.before, base), after = base && at(row.after, base);
    const oversight = before && pairedIndex(row, ['stewardship', 'oversight'], 'estateId', before.estateId);
    if (base && oversight && before.estateId !== 'estate-home' && before.estateId === after.estateId
      && before.kind === after.kind && ['rent_relief', 'market_dues', 'repair', 'common_dispute', 'charter_request', 'marriage_licence'].includes(before.kind)
      && before.status === 'open' && typeof row.command.grant === 'boolean' && after.status === (row.command.grant ? 'granted' : 'refused')
      && after.decidedBy === 'lord' && numeric(before.deadline) && before.deadline >= row.tick) {
      add(['treasuryCoin'], 'money'); add([...oversight, 'tenants'], 'relation'); add([...oversight, 'merchants'], 'relation');
      bookkeeping.push([...base, 'status'], [...base, 'decidedBy']);
      if (inertProfile && before.kind === 'charter_request' && !row.command.grant) bookkeeping.push([...oversight, 'charterResistance']);
      complete = true; review = 'stewardship.ts:175-185,471-500; history.ts:1045-1110';
      if (before.kind === 'repair' && !row.command.grant) {
        const estate = pairedIndex(row, ['estates', 'estates'], 'id', before.estateId);
        if (estate) add([...estate, 'annualValue'], 'land'); else complete = false;
      }
    }
  } else if (row.command.type === 'answer_audit' && row.command.choice === 'tolerate') {
    const base = pairedIndex(row, ['stewardship', 'audits'], 'id', row.command.auditId);
    const before = base && at(row.before, base), after = base && at(row.after, base);
    const steward = before && pairedIndex(row, ['stewardship', 'stewards'], 'personId', before.stewardId);
    if (base && steward && before.status === 'pending' && after.status === 'tolerated'
      && before.stewardId === after.stewardId && before.estateId === after.estateId
      && numeric(before.tick) && before.tick <= row.tick && numeric(before.deadline) && before.deadline >= row.tick) {
      add([...steward, 'loyalty'], 'relation'); bookkeeping.push([...base, 'status']);
      if (inertProfile) {
        bookkeeping.push([...base, 'unrecovered'], [...base, 'decidedBy'], [...steward, 'toleratedErrors']);
        for (const field of ['auditId', 'since', 'baselineLoss', 'baselineLoyalty', 'perSeason'])
          bookkeeping.push([...steward, 'auditTolerance', field]);
      }
      complete = true; review = 'stewardship.ts:543-552; history.ts:1110-1115';
    }
  }
  return { paths, bookkeeping, complete, review };
}

/** Consumes only authenticated loader rows. Unknown writes never establish an exhaustive zero-effect claim. */
export function buildTlinkOutcomeEvidence(loaded) {
  const pins = loaded.provenance.sourceFiles;
  const matches = profile => profile.every(pin => pins.some(source => source.path === pin.path && source.sha256 === pin.sha256));
  const inertProfile = matches(INERT_REVIEWED_EFFECT_SOURCES);
  const compatible = inertProfile || matches(TLINK_REVIEWED_EFFECT_SOURCES);
  const sourceFiles = inertProfile ? INERT_REVIEWED_EFFECT_SOURCES : compatible ? TLINK_REVIEWED_EFFECT_SOURCES : pins.slice(0, 1);
  const rows = loaded.rows.map(row => {
    const identity = { seed: row.seed, historyId: row.historyId, ordinal: row.ordinal, tick: row.tick, source: row.source };
    if (!compatible) return { ...identity, proofComplete: false, effects: [], scope: { relevantPaths: [], sourceFiles }, unsupportedReason: 'reviewed_source_pin_mismatch' };
    const scope = reviewedScope(row, inertProfile), effects = new Map(), unknown = [];
    for (const { path, kind } of scope.paths.values()) {
      const value = effect(row, path, kind);
      if (!value.beforePresent || !value.afterPresent || !numeric(value.before) || !numeric(value.after)) scope.complete = false;
      else effects.set(key(path), value);
    }
    for (const path of row.deltaPaths.flatMap(delta => policyDeltaPaths(row, delta.path))) {
      if (effects.has(key(path))) continue;
      const kind = scalarKind(row, path);
      const policyMetadata = path[3] === 'auditTolerance';
      const knownPolicyValue = value => value === undefined || (path[4] === 'auditId'
        ? typeof value === 'string' && value.length > 0 : Number.isSafeInteger(value) && value >= 0);
      const bookkeeping = scope.bookkeeping.some(base => policyMetadata
        ? key(path) === key(base) && knownPolicyValue(at(row.before, path)) && knownPolicyValue(at(row.after, path))
        : prefix(path, base));
      if (kind) effects.set(key(path), effect(row, path, kind));
      else if (bookkeeping) effects.set(key(path), effect(row, path, 'bookkeeping'));
      else unknown.push(path);
    }
    return { ...identity, proofComplete: scope.complete && unknown.length === 0, effects: [...effects.values()],
      scope: { relevantPaths: [...effects.values()].map(value => value.path), sourceFiles, review: scope.review },
      unknownChangedPaths: unknown, artifact: row.artifact,
      noImmediateChangeClaim: scope.complete && unknown.length === 0 && [...effects.values()].filter(value => value.kind !== 'bookkeeping')
        .every(value => value.beforePresent === value.afterPresent && isDeepStrictEqual(value.before, value.after)) };
  });
  return { schemaVersion: 1, originalScoreSha256: loaded.provenance.originalScoreSha256, provenance: loaded.provenance, rows,
    limitations: ['Only the authenticated loader establishes observed before/after bytes and original answer identity.',
      'Exhaustive zero-effect scopes cover off-map estate petitions and tolerated audits only. Other commands remain partial.',
      'Petition processing status/decidedBy and audit processing status are bookkeeping, never a gameplay effect.',
      'EB-INERT pressure schedules and unrecovered accounting amounts alone never prove a visible effect: their actual future loss must have an exact linked receipt.',
      'A changed recognised scalar proves that actual value changed; unknown writes prevent an exhaustive inert classification.',
      'No future condition is inferred from an absent receipt, and no receipt or legacy score is changed.'] };
}
