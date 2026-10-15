import assert from 'node:assert/strict';
import type { AnswerEffect } from '../../src/engine/answerEffects.types';
import type { GameState } from '../../src/engine/engine.types';
import { estatesOf } from '../../src/engine/estates';
import { diplomacyOf } from '../../src/engine/negotiation';
import { stewardshipOf } from '../../src/engine/stewardship';

const object = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
// Independent whole-state oracle, adapted from Render A answerReceipts.test.ts. Unlike its original exclusions,
// marriage stages, people, construction and negotiation terms must have exact-value evidence here.
const IGNORE = [/^(history|trace|ledger|tick|rngState|lastCommand|commandLog|seen)(\.|$)/, /\.(memory|timeline|history)(\.|$)/,
  /^registry\.(?!terms)/, /^politics\.(decisions|chronicle)(\.|$)/, /^stewardship\.(petitions|audits)\.[^.]+\.(status|decidedBy|policy)$/, /^politics\.petitions\.[^.]+\.(status|response|decidedTick|respondedTick)$/,
  /\.(id|settledTick)$/, /(^|\.)next[A-Z][^.]*$/, /^agency\.duesAgreement\.(tick|occurrenceId)$/,
  /^(walkers|workers|pathCache)(\.|$)/];
export function checkEffectCoverage(before: GameState, after: GameState, effects: readonly AnswerEffect[], label: string): void {
  const byPath = new Map(effects.filter(e => e.target !== 'audit_recovery').map(e => [JSON.stringify(e.path), e]));
  const witnessed = new Set<string>();
  const visit = (a: unknown, b: unknown, path: string[]): void => {
    if (a === b || IGNORE.some(rule => rule.test(path.join('.')))) return;
    if (Array.isArray(a) || Array.isArray(b)) {
      const entries = (value: unknown) => new Map((Array.isArray(value) ? value : []).map((item: unknown, i: number) => [String(object(item) ? item.id ?? item.personId ?? item.estateId ?? i : i), item]));
      const left = entries(a), right = entries(b);
      for (const key of new Set([...left.keys(), ...right.keys()])) visit(left.get(key), right.get(key), [...path, key]);
    } else if (object(a) || object(b)) {
      const left = object(a) ? a : {}, right = object(b) ? b : {};
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) visit(left[key], right[key], [...path, key]);
    } else {
      const key = JSON.stringify(path), effect = byPath.get(key);
      assert.ok(effect, `${label}: missing ${path.join('.')} (${String(a)} → ${String(b)})`);
      assert.equal(effect.before, a ?? null, `${label}: ${key} before`);
      assert.equal(effect.after, b ?? null, `${label}: ${key} after`);
      assert.equal(effect.beforePresent, a !== undefined);
      assert.equal(effect.afterPresent, b !== undefined);
      assert.equal(effect.delta, typeof a === 'number' && typeof b === 'number' ? b - a : null);
      witnessed.add(key);
    }
  };
  const relationIds = new Set([...Object.keys(before.diplomacy?.relations ?? {}), ...Object.keys(after.diplomacy?.relations ?? {})]);
  const fill = (s: GameState) => ({ ...s, timberOrder: s.timberOrder ?? 0, estates: estatesOf(s), diplomacy: { ...diplomacyOf(s), relations: Object.fromEntries([...relationIds].map(id => [id, s.diplomacy?.relations[id] ?? 0])) }, stewardship: stewardshipOf(s) });
  visit(fill(before), fill(after), []);
  for (const offer of after.diplomacy?.negotiations ?? []) {
    const prior = before.diplomacy?.negotiations.find(row => row.id === offer.id);
    if (prior && prior.status !== 'accepted' && offer.status === 'accepted' && offer.counter) {
      visit(prior.terms, offer.counter.terms, ['diplomacy', 'negotiations', offer.id, 'effectiveTerms']);
    }
  }
  for (const [key] of byPath) assert.ok(witnessed.has(key), `${label}: effect without independently observed change ${key}`);
}
