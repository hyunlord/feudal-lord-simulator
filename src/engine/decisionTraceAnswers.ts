import { captureAnswerEffects } from './answerEffectCapture';
import type { AnswerEffect } from './answerEffects.types';
import { BALANCE } from '../content/balanceConfig';
import type { HistoryBecause } from './history.types';
import type { GameState } from './engine.types';
import type { TracedAnswerContribution, TracedDecision, TraceState } from './decisionTrace.types';

const LIVE = 3 * BALANCE.TICKS_PER_YEAR;
const exclusive = (target: string) => ['dues', 'timber', 'rules', 'policy', 'war_tax'].includes(target) || target.startsWith('subsidy:') || target.startsWith('rules:') || target.startsWith('audit_mode:') || target.startsWith('oversight:') || target.startsWith('oversight_mode:');

/** Legacy roots remain usable, but never substitute for a recorded answer membership. */
export function answerContributions(trace: TraceState): readonly TracedDecision[] {
  const represented = new Set(trace.answers?.map(answer => answer.id));
  return [...trace.decisions.filter(root => !represented.has(root.id)), ...(trace.answers ?? [])].sort((left, right) => left.tick - right.tick);
}
export function answerContributionsOn(trace: TraceState, target: string, tick: number): readonly TracedDecision[] {
  const all = answerContributions(trace).filter(answer => answer.targets.includes(target) && answer.tick <= tick);
  const eligible = exclusive(target) ? all.slice(-1) : all;
  return eligible.filter(answer => tick - answer.tick <= LIVE);
}

/** Store the command's own footprint before a matter union can broaden it. Faction rule inputs are unchanged. */
export function retainAnswer(before: GameState, after: GameState, answer: TracedDecision, threadId: string): GameState {
  const evidence: TracedAnswerContribution['memoryEvidence'][number][] = [];
  for (const faction of after.factions?.factions ?? []) {
    const known = new Set(before.factions?.factions.find(row => row.id === faction.id)?.memory.map(row => row.recordId));
    for (const memory of faction.memory) {
      if (!known.has(memory.recordId) && memory.reason === answer.source && memory.tick === answer.tick)
        evidence.push({ factionId: faction.id, recordId: memory.recordId, tick: memory.tick, delta: memory.delta, reason: memory.reason });
    }
  }
  const targets = [...new Set([...answer.targets, ...evidence.map(memory => `faction:${memory.factionId}`)])].sort();
  const trace = after.trace ?? { decisions: [], acts: [] };
  return { ...after, trace: { ...trace, answers: [...(trace.answers ?? []), { ...answer, targets, threadId, memoryEvidence: evidence, effects: captureAnswerEffects(before, after) }] } };
}

/** Faction acts still execute using original root memories. Only their completed history receipt gains exact contributors. */
export function linkAnswerFactionReceipts(before: GameState, after: GameState): GameState {
  if (!after.history || !after.trace?.answers?.length || after.history.nextOrdinal === before.history?.nextOrdinal) return after;
  const known = new Set(before.history?.records.map(record => record.id));
  let changed = false;
  const records = after.history.records.map(record => {
    if (known.has(record.id) || record.template !== 'faction.act' || !record.because?.length) return record;
    const factionId = record.params?.faction, relation = record.params?.relation;
    if (typeof factionId !== 'string' || typeof relation !== 'number') return record;
    const act = after.trace?.acts.find(row => row.factionId === factionId && row.tick === record.tick && row.act === record.params?.act);
    const faction = after.factions?.factions.find(row => row.id === factionId);
    if (!act || !faction) return record;
    const shares = new Map<string, { readonly cause: HistoryBecause; readonly magnitude: number }>();
    const add = (cause: HistoryBecause, magnitude: number) => {
      shares.set(cause.decisionId, { cause, magnitude: (shares.get(cause.decisionId)?.magnitude ?? 0) + magnitude });
    };
    for (const cause of record.because) {
      const live = faction.memory.filter(memory => memory.decisionId === cause.decisionId
        && record.tick - memory.tick <= LIVE && Math.sign(memory.delta) === act.direction);
      if (live.length === 0) { add(cause, 0); continue; }
      for (const memory of live) {
        const members = after.trace?.answers?.filter(answer => answer.threadId === cause.decisionId && answer.tick < record.tick
          && answer.memoryEvidence.some(evidence => evidence.factionId === factionId && evidence.recordId === memory.recordId
            && evidence.tick === memory.tick && evidence.reason === memory.reason && evidence.delta === memory.delta)) ?? [];
        // Ambiguous membership stays on its existing root; no speculative redistribution.
        const member = members.length === 1 ? members[0] : undefined;
        add(member ? { ...cause, decisionId: member.id, part: true } : cause, Math.abs(memory.delta));
      }
    }
    const because = [...shares.values()].sort((left, right) => right.magnitude - left.magnitude
      || (left.cause.decisionId < right.cause.decisionId ? -1 : left.cause.decisionId > right.cause.decisionId ? 1 : 0)).map(row => row.cause);
    changed = true;
    return { ...record, because };
  });
  return changed ? { ...after, history: { ...after.history, records } } : after;
}

/** Answer-time evidence only. Unknown/legacy answers return undefined, not an invented zero effect. */
export function answerEffects(state: Pick<GameState, "trace">, answerId: string): readonly AnswerEffect[] | undefined {
  return state.trace?.answers?.find(answer => answer.id === answerId)?.effects;
}
