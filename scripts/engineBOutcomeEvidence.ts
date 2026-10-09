import { HOME_ESTATE_ID } from '../src/content/estateConfig';
import { COMMAND_WEIGHT, type DecisionWeight } from '../src/content/stewardPolicyConfig';
import { cameHeavyToLord, weighOffer } from '../src/engine/decisionLayer';
import type { TracedDecision, TracedDecisionKind } from '../src/engine/decisionTrace.types';
import type { GameState } from '../src/engine/engine.types';
import type { HistoryRecord } from '../src/engine/history.types';
import type { PetitionRecord } from '../src/engine/politics.types';
import type { RegistryOccurrence } from '../src/engine/registry.types';
import { registryChapterPetitionDef } from '../src/engine/registryChapterPetitions';
import type { EstatePetition } from '../src/engine/stewardship.types';
import type { GameAction } from '../src/state/gameStore.types';

export type Command = GameAction;
/** The producer verifies this private taxonomy against the current engine AST before collecting. */
export const OUTCOME_COMMAND_KIND: Readonly<Record<string, TracedDecisionKind>> = {
  answer_registry_offer: 'registry', answer_estate_petition: 'estate_petition', petition_response: 'chapter_petition', famine_response: 'famine',
  file_suit: 'suit', add_suit_evidence: 'suit', seek_suit_patron: 'suit', enforce_possession: 'suit',
  add_defence_evidence: 'suit', seek_defence_patron: 'suit', settle_suit: 'suit', hold_possession: 'suit', guard_possession: 'suit', appease_neighbour: 'suit',
  propose_marriage: 'marriage', answer_counter: 'marriage', keep_promise: 'marriage', answer_will_change: 'marriage',
  set_estate_oversight: 'oversight', set_audit_mode: 'oversight', set_exception_rules: 'oversight', answer_audit: 'audit',
  set_estate_policy: 'policy', set_project_subsidy: 'subsidy', set_market_dues: 'dues', order_timber: 'timber', set_standing_policy: 'standing_policy',
};
export interface AnswerEvidence {
  readonly ordinal: number;
  readonly tick: number;
  readonly command: Command;
  readonly stateChanged: boolean;
  readonly agencyPresent: boolean;
  readonly beforeHistoryLength: number;
  readonly afterHistoryLength: number;
  readonly history: HistoryRecord | null;
  readonly ownRoot: TracedDecision | null;
  readonly context: {
    readonly estateBefore: EstatePetition | null;
    readonly estateAfter: EstatePetition | null;
    readonly registryAfter: RegistryOccurrence | null;
    readonly chapterAfter: PetitionRecord | null;
    readonly chapterBeforeState: GameState | null;
  };
}
export function createAnswerEvidenceCollector() {
  const records: AnswerEvidence[] = [];
  return {
    observe(before: GameState, after: GameState, command: Command, ordinal: number): void {
      const beforeHistoryLength = before.history?.records.length ?? 0;
      const afterHistory = after.history?.records ?? [];
      let history: HistoryRecord | null = null;
      for (let index = afterHistory.length - 1; index >= beforeHistoryLength; index -= 1) {
        const row = afterHistory[index];
        if (row?.kind === 'decision') { history = row; break; }
      }
      const estateBefore = command.type === 'answer_estate_petition' ? before.stewardship?.petitions.find(row => row.id === command.petitionId) ?? null : null;
      const estateAfter = command.type === 'answer_estate_petition' ? after.stewardship?.petitions.find(row => row.id === command.petitionId) ?? null : null;
      const registryAfter = command.type === 'answer_registry_offer' ? after.registry?.occurrences.find(row => row.id === command.occurrenceId) ?? null : null;
      const chapterAfter = command.type === 'petition_response' ? after.politics?.petitions.find(row => row.id === command.petitionId) ?? null : null;
      const chapterBeforeState = chapterAfter !== null && registryChapterPetitionDef(chapterAfter.defId) !== undefined ? before : null;
      records.push(structuredClone({ ordinal, tick: after.tick, command, stateChanged: before !== after, agencyPresent: after.agency !== undefined,
        beforeHistoryLength, afterHistoryLength: afterHistory.length, history,
        ownRoot: history === null ? null : after.trace?.decisions.find(row => row.id === history.id) ?? null,
        context: { estateBefore, estateAfter, registryAfter, chapterAfter, chapterBeforeState } }));
    },
    snapshot(): readonly AnswerEvidence[] { return structuredClone(records); },
  };
}
export interface ClassifiedAnswerEvidence {
  readonly ordinal: number;
  readonly tick: number;
  readonly command: string;
  readonly historyId: string | null;
  readonly status: 'classified' | 'unclassified' | 'unresolved' | 'excluded';
  readonly reason: string | null;
  readonly source: string | null;
  readonly kind: TracedDecisionKind | null;
  readonly weights: readonly DecisionWeight[] | null;
  readonly cameHeavyToLord: boolean | null;
}
function classify(record: AnswerEvidence): ClassifiedAnswerEvidence {
  const base = { ordinal: record.ordinal, tick: record.tick, command: record.command.type, historyId: record.history?.id ?? null };
  const fail = (status: ClassifiedAnswerEvidence['status'], reason: string): ClassifiedAnswerEvidence =>
    ({ ...base, status, reason, source: null, kind: null, weights: null, cameHeavyToLord: null });
  const action: Readonly<Record<string, unknown>> = { ...record.command };
  let kind = OUTCOME_COMMAND_KIND[record.command.type];
  if (kind === undefined) return record.history === null ? fail('excluded', 'no_new_decision_outside_trace_taxonomy')
    : fail('unclassified', 'history_command_outside_pinned_trace_taxonomy');
  if (!record.stateChanged || !record.agencyPresent) return fail('excluded', 'unchanged_or_non_lord_state');
  if (record.command.type === 'answer_registry_offer' && record.context.registryAfter?.status === 'invalid') return fail('excluded', 'invalid_registry_answer');
  if (record.history === null) return fail('excluded', 'no_new_history_decision_by_pinned_length_semantics');
  if (record.history.kind !== 'decision' || record.history.tick !== record.tick
    || record.afterHistoryLength <= record.beforeHistoryLength
    || (record.history.params?.command !== undefined && record.history.params.command !== record.command.type)) return fail('unresolved', 'history_identity_mismatch');
  let source: string = record.command.type;
  const defaultWeight = COMMAND_WEIGHT[record.command.type];
  let weights: readonly DecisionWeight[] = defaultWeight === undefined ? [] : [defaultWeight];
  switch (record.command.type) {
    case 'answer_registry_offer': {
      const occurrence = record.context.registryAfter;
      if (occurrence === null || occurrence.id !== record.command.occurrenceId || occurrence.status !== 'answered'
        || occurrence.choiceId !== record.command.choiceId || occurrence.settledTick !== record.tick
        || record.history.params?.subjectId !== occurrence.id) return fail('unresolved', 'missing_or_mismatched_registry_context');
      source = `registry:${occurrence.entryId}:${String(record.command.choiceId)}`;
      weights = [...(occurrence.weights ?? [])];
      break;
    }
    case 'answer_estate_petition': {
      const before = record.context.estateBefore, petition = record.context.estateAfter;
      if (before === null || petition === null || before.id !== record.command.petitionId || petition.id !== before.id
        || record.history.params?.subjectId !== petition.id || !['granted', 'refused', 'lapsed'].includes(petition.status)) return fail('unresolved', 'missing_or_mismatched_estate_context');
      const manor = petition.estateId === HOME_ESTATE_ID;
      kind = manor ? 'manor_petition' : 'estate_petition';
      source = manor ? `manor_petition:${petition.kind}:${petition.status}` : `estate_petition:${petition.estateId}:${petition.kind}:${petition.status}`;
      weights = petition.escalated === 'amount' ? ['large_sum'] : petition.escalated === 'rights' ? ['rights'] : [];
      break;
    }
    case 'petition_response': {
      const petition = record.context.chapterAfter;
      if (petition === null || petition.id !== record.command.petitionId) return fail('unresolved', 'missing_chapter_response_context');
      source = `petition:${petition.defId}:${String(record.command.response)}`;
      if (registryChapterPetitionDef(petition.defId) !== undefined) {
        const before = record.context.chapterBeforeState;
        if (before === null || before.tick !== record.tick) return fail('unresolved', 'missing_actual_chapter_before_state');
        const occurrence = before.registry?.occurrences.find(row => row.source === 'v4' && row.entryId === petition.defId && row.bound?.chapterPetition === petition.id);
        if (occurrence !== undefined) weights = [...(weighOffer(before, occurrence)?.weights ?? occurrence.weights ?? [])];
      }
      break;
    }
    case 'famine_response': source = `famine:${String(record.command.choice)}`; break;
    case 'answer_audit': source = record.command.choice === 'punish' ? `steward_punished:${String(record.command.auditId)}` : `audit:${String(record.command.choice)}:${String(record.command.auditId)}`; break;
    default: {
      const subject = action.suitId ?? action.claimId ?? action.negotiationId ?? action.promiseId ?? action.estateId ?? action.policy ?? action.kind ?? action.permille ?? action.amount;
      source = subject === undefined ? record.command.type : `${record.command.type}:${String(subject)}`;
    }
  }
  const root = record.ownRoot;
  if (root !== null && (root.id !== record.history.id || root.tick !== record.tick || root.by !== 'lord' || root.lapsed === true
    || root.kind !== kind || root.source !== source || JSON.stringify(root.weights) !== JSON.stringify(weights))) return fail('unresolved', 'own_root_classification_mismatch');
  return { ...base, status: 'classified', reason: null, source, kind, weights, cameHeavyToLord: cameHeavyToLord({ by: 'lord', source, weights }) };
}
export function classifyAnswerEvidence(records: readonly AnswerEvidence[]) {
  const ordinals = new Map<number, number>();
  const historyIds = new Map<string, number>();
  for (const record of records) {
    ordinals.set(record.ordinal, (ordinals.get(record.ordinal) ?? 0) + 1);
    if (record.history !== null) historyIds.set(record.history.id, (historyIds.get(record.history.id) ?? 0) + 1);
  }
  const rows: ClassifiedAnswerEvidence[] = records.map(record => {
    const reason = !Number.isSafeInteger(record.ordinal) || record.ordinal <= 0 ? 'invalid_command_ordinal'
      : (ordinals.get(record.ordinal) ?? 0) > 1 ? 'duplicate_command_ordinal'
        : record.history !== null && (historyIds.get(record.history.id) ?? 0) > 1 ? 'duplicate_answer_history_id' : null;
    if (reason !== null) return { ordinal: record.ordinal, tick: record.tick, command: record.command.type,
      historyId: record.history?.id ?? null, status: 'unresolved', reason, source: null, kind: null, weights: null, cameHeavyToLord: null };
    return classify(record);
  });
  return { rows, classified: rows.filter(row => row.status === 'classified'), unclassified: rows.filter(row => row.status === 'unclassified'),
    unresolved: rows.filter(row => row.status === 'unresolved'), excluded: rows.filter(row => row.status === 'excluded') };
}
