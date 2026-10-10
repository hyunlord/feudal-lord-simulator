import { answerEffectsProblem } from './answerEffectsValidation';
import { PRESSURE_BALANCE } from '../content/balanceConfig';
import { DECISION_WEIGHTS, STANDING_SETTINGS } from '../content/stewardPolicyConfig';
import type { TracedDecisionKind } from '../engine/decisionTrace.types';

const KINDS = { registry: true, manor_petition: true, estate_petition: true, chapter_petition: true, famine: true,
  suit: true, marriage: true, oversight: true, audit: true, policy: true, subsidy: true, dues: true, timber: true,
  standing_policy: true } satisfies Record<TracedDecisionKind, true>;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const tick = (value: unknown, end: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= end;
const strings = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
const known = (values: readonly string[], value: unknown) => typeof value === 'string' && values.includes(value);

/** Optional legacy absence is unknown. Validate new contributions without reconstructing aliases or requiring pruned roots. */
export function traceAnswerProblem(state: Readonly<Record<string, unknown>>): string | null {
  const trace = state.trace;
  if (!object(trace) || !Object.hasOwn(trace, 'answers')) return null;
  if (!Array.isArray(trace.answers)) return 'trace.answers must be an array';
  const ids = new Set<string>();
  const end = typeof state.tick === 'number' ? state.tick : -1;
  for (const [index, answer] of trace.answers.entries()) {
    const at = `trace.answers[${index}]`;
    if (!object(answer)) return `${at} must be an object`;
    if (!text(answer.id) || ids.has(answer.id)) return `${at}.id must be nonempty and unique`;
    ids.add(answer.id);
    if (!text(answer.threadId) || !text(answer.source)) return `${at} must name its thread and source`;
    if (!tick(answer.tick, end)) return `${at}.tick must be a nonnegative integer no later than the state tick`;
    if (answer.by !== 'lord' && answer.by !== 'steward') return `${at}.by is unknown`;
    if (!text(answer.kind) || !Object.hasOwn(KINDS, answer.kind)) return `${at}.kind is unknown`;
    if (!strings(answer.targets)) return `${at}.targets must be unique nonempty strings`;
    if (!strings(answer.weights) || !answer.weights.every(value => known(DECISION_WEIGHTS, value))) return `${at}.weights is invalid`;
    if (answer.policy !== undefined && !known(STANDING_SETTINGS, answer.policy)) return `${at}.policy is unknown`;
    if (answer.also !== undefined && !strings(answer.also)) return `${at}.also must be unique nonempty strings`;
    if (answer.lastTick !== undefined && (!tick(answer.lastTick, end) || answer.lastTick < answer.tick)) return `${at}.lastTick is invalid`;
    if (answer.lapsed !== undefined && answer.lapsed !== true) return `${at}.lapsed must be true when present`;
    if (Object.hasOwn(answer, 'estateRelationEvidence')) {
      if (!Array.isArray(answer.estateRelationEvidence) || answer.estateRelationEvidence.length > 2) return `${at}.estateRelationEvidence must be a bounded array`;
      if (answer.kind !== 'estate_petition') return `${at}.estateRelationEvidence requires a supported answer`;
      const dimensions = new Set<string>();
      for (const proof of answer.estateRelationEvidence) {
        if (!object(proof) || !text(proof.estateId) || !known(['tenants', 'merchants'], proof.dimension)
          || !known(['pending', 'consumed', 'invalidated'], proof.status)) return `${at}.estateRelationEvidence identity/status is invalid`;
        for (const field of ['before', 'after', 'expected']) {
          if (typeof proof[field] !== 'number' || !Number.isSafeInteger(proof[field]) || proof[field] < -100 || proof[field] > 100)
            return `${at}.estateRelationEvidence relation is invalid`;
        }
        if (typeof proof.before !== 'number' || typeof proof.after !== 'number' || typeof proof.intended !== 'number'
          || !Number.isSafeInteger(proof.intended) || proof.intended === 0 || Math.abs(proof.intended) > 200
          || proof.actual !== proof.after - proof.before) return `${at}.estateRelationEvidence delta is invalid`;
        if (proof.firstSeasonTick !== (Math.floor(answer.tick / PRESSURE_BALANCE.seasonTicks) + 1) * PRESSURE_BALANCE.seasonTicks)
          return `${at}.estateRelationEvidence first season is invalid`;
        if (proof.status !== 'invalidated' && (proof.actual === 0 || proof.actual !== proof.intended || proof.after <= -100 || proof.after >= 100))
          return `${at}.estateRelationEvidence cannot preserve a clamped or zero contribution`;
        if (proof.status === 'pending' && (typeof proof.expected !== 'number' || proof.expected <= -100 || proof.expected >= 100 || end >= Number(proof.firstSeasonTick)))
          return `${at}.estateRelationEvidence pending chain is invalid`;
        if (proof.status === 'consumed' && end < Number(proof.firstSeasonTick)) return `${at}.estateRelationEvidence consumed too early`;
        const key = `${proof.estateId}:${String(proof.dimension)}`;
        if (dimensions.has(key)) return `${at}.estateRelationEvidence repeats a dimension`;
        dimensions.add(key);
      }
    }
    if (Object.hasOwn(answer, 'effects')) {
      const problem = answerEffectsProblem(answer.effects);
      if (problem !== null) return `${at}.${problem}`;
    }
    if (!Array.isArray(answer.memoryEvidence)) return `${at}.memoryEvidence must be an array`;
    const memories = new Set<string>();
    for (const memory of answer.memoryEvidence) {
      if (!object(memory) || !text(memory.factionId) || !text(memory.recordId)
        || memory.tick !== answer.tick || memory.reason !== answer.source
        || typeof memory.delta !== 'number' || !Number.isSafeInteger(memory.delta)) return `${at}.memoryEvidence is invalid`;
      const key = JSON.stringify([memory.factionId, memory.recordId]);
      if (memories.has(key)) return `${at}.memoryEvidence must not duplicate a faction record`;
      memories.add(key);
    }
  }
  return null;
}
