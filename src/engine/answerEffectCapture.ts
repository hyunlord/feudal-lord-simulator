import type { AnswerEffect, AnswerEffectTarget, AnswerEffectValue } from './answerEffects.types';
import type { GameState } from './engine.types';
import { estatesOf } from './estates';
import { diplomacyOf } from './negotiation';
import { stewardshipOf } from './stewardship';

const object = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);
const scalar = (value: unknown): AnswerEffectValue => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null;
const identity = (value: unknown, index: number): string => object(value) ? String(value.id ?? value.personId ?? value.estateId ?? index) : String(index);

/** These counters/receipts describe processing, not a change in the world. */
function bookkeeping(path: readonly string[]): boolean {
  const last = path.at(-1) ?? '';
  if (['memory', 'timeline', 'history', 'nextOrdinal', 'nextNegotiation', 'nextPromise', 'nextClaim', 'nextSuit', 'nextPetition', 'nextAudit',
    'nextSteward', 'nextPerson', 'nextEstate', 'nextSubsidy', 'nextRequest', 'nextOrder', 'id', 'settledTick'].includes(last)) return true;
  if (path[0] === 'stewardship' && path.includes('auditTolerance') && ['auditId', 'since'].includes(last)) return true;
  if (last === 'policyAuditId' && path[0] === 'stewardship' && path[1] === 'audits') return true;
  if (last.startsWith('next') && /[A-Z]/.test(last[4] ?? '')) return true;
  if (path[0] === 'stewardship' && ['petitions', 'audits'].includes(path[1] ?? '') && ['status', 'decidedBy', 'policy', 'unrecovered', 'superseded'].includes(last)) return true;
  if (path[0] === 'politics' && path[1] === 'petitions' && ['status', 'response', 'decidedTick', 'respondedTick'].includes(last)) return true;
  if (path[0] === 'politics' && ['decisions', 'chronicle'].includes(path[1] ?? '')) return true;
  return path[0] === 'agency' && path[1] === 'duesAgreement' && ['tick', 'occurrenceId'].includes(last);
}
function target(path: readonly string[]): AnswerEffectTarget {
  const root = path[0], leaf = path.at(-1);
  if (root === 'treasuryCoin' || root === 'treasuryTimber') return 'treasury';
  if (root === 'factions' || path[1] === 'relations' || ['tenants', 'merchants', 'loyalty'].includes(leaf ?? '')) return 'relation';
  if (path[1] === 'standing' || path[1] === 'oversight' || path[1] === 'rules' || path[1] === 'stewards') return 'oversight';
  if (path[1] === 'people' || root === 'persons' || root === 'lordship') return 'person';
  if (path[1] === 'rights' || path[1] === 'pieces' || path[1] === 'claims' || path[1] === 'suits') return 'right';
  if (path.includes('terms') || path.includes('counterTerms') || path.includes('effectiveTerms') || root === 'registry') return 'term';
  if (root === 'diplomacy') return 'marriage';
  if (root === 'tiles' || root === 'buildings' || root === 'houses' || root === 'estates' || root === 'land' || root === 'zones' || root === 'arableFields') return 'land';
  if (root === 'events' && path.includes('response')) return 'command';
  if (root === 'palisade' || root === 'wallConstructionReserve' || root === 'eraProclaimedTick' || root === 'timberOrder' || root === 'constructionSites' || root === 'wallConstructionPriority' || path[1] === 'orders' || path[1] === 'requests') return 'command';
  return 'condition';
}

/** Walk only changed semantic slices. No simulation, clock or RNG calls; values are copied scalars. */
export function captureAnswerEffects(before: GameState, after: GameState): readonly AnswerEffect[] {
  const out: AnswerEffect[] = [];
  const relationKeys = [...new Set([...Object.keys(before.diplomacy?.relations ?? {}), ...Object.keys(after.diplomacy?.relations ?? {})])];
  const walk = (a: unknown, b: unknown, path: readonly string[]): void => {
    if (a === b || bookkeeping(path)) return;
    if (Array.isArray(a) || Array.isArray(b)) {
      const left = new Map((Array.isArray(a) ? a : []).map((item, index) => [identity(item, index), item]));
      const right = new Map((Array.isArray(b) ? b : []).map((item, index) => [identity(item, index), item]));
      for (const key of new Set([...left.keys(), ...right.keys()])) walk(left.get(key), right.get(key), [...path, key]);
      return;
    }
    if (object(a) || object(b)) {
      const left = object(a) ? a : {}, right = object(b) ? b : {};
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) walk(left[key], right[key], [...path, key]);
      return;
    }
    out.push({ target: target(path), path, before: scalar(a), after: scalar(b), beforePresent: a !== undefined, afterPresent: b !== undefined,
      delta: typeof a === 'number' && typeof b === 'number' ? b - a : null });
  };
  const slice = (state: GameState) => ({
    treasuryCoin: state.treasuryCoin, treasuryTimber: state.treasuryTimber, timberOrder: state.timberOrder ?? 0,
    era: state.era, wallConstructionPriority: state.wallConstructionPriority,
    agency: state.agency, estates: estatesOf(state), diplomacy: { ...diplomacyOf(state), relations: Object.fromEntries(relationKeys.map(id => [id, state.diplomacy?.relations[id] ?? 0])) }, stewardship: stewardshipOf(state),
    factions: { factions: state.factions?.factions.map(row => ({ id: row.id, relation: row.relation })) ?? [] },
    registry: { terms: state.registry?.terms ?? [] }, politics: state.politics, events: state.events, money: state.money, trades: state.trades,
    land: state.land, lordship: state.lordship, persons: state.persons, war: state.war, plague: state.plague,
    reorganisation: state.reorganisation, legacy: state.legacy, ale: state.ale,
    palisade: state.palisade, wallConstructionReserve: state.wallConstructionReserve, eraProclaimedTick: state.eraProclaimedTick,
    tiles: state.tiles, buildings: state.buildings, houses: state.houses, population: state.population,
    constructionSites: state.constructionSites, zones: state.zones, arableFields: state.arableFields,
  });
  walk(slice(before), slice(after), []);
  for (const offer of after.diplomacy?.negotiations ?? []) {
    const previous = before.diplomacy?.negotiations.find(row => row.id === offer.id);
    if (previous && previous.status !== 'accepted' && offer.status === 'accepted' && offer.counter) {
      // The rules apply counter.terms on acceptance without overwriting the original offered terms.
      walk(previous.terms, offer.counter.terms, ['diplomacy', 'negotiations', offer.id, 'effectiveTerms']);
    }
  }
  const known = new Set(before.ledger?.entries.map(entry => entry.id));
  for (const entry of after.ledger?.entries ?? []) {
    if (known.has(entry.id) || entry.account !== 'cash' || entry.category !== 'audit_recovery' || entry.amount === 0) continue;
    const audit = entry.sourceRefs.find(ref => ref.type === 'claim' && ref.detail === 'audit');
    if (!audit) continue;
    // This receipt is a component of the cash change, never an additional cash gain.
    out.push({ target: 'audit_recovery', path: ['auditRecovery', audit.id, entry.id], before: 0, after: entry.amount,
      beforePresent: true, afterPresent: true, delta: entry.amount });
  }
  return out;
}
