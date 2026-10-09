import { HOME_ESTATE_ID } from '../content/estateConfig';
import { HOME_PETITION_VARIANTS, REGISTRY_VARIANT_LINKS } from '../content/registry/registryVariantConfig';
import { V4_COPY } from '../content/registry/v4Copy.generated';
import { HOME_PETITION_KINDS } from '../content/stewardshipConfig';
import type { GameState } from './engine.types';
import type { HistoryParams, HistoryRecord } from './history.types';

export type DecisionPresentation = Readonly<{ sourceEntryId: string; displayEntryId: string }>;

function linked(source: string, display: string): boolean {
  if (source.startsWith('home:')) {
    const kind = source.slice(5);
    return Object.hasOwn(HOME_PETITION_KINDS, kind)
      && (display === source || HOME_PETITION_VARIANTS[kind] === display);
  }
  return Object.hasOwn(V4_COPY, source)
    && (display === source || REGISTRY_VARIANT_LINKS[source]?.variantEntryId === display);
}

/** Read saved answer provenance without selecting a variant from today's state. Missing means unknown. */
export function decisionPresentation(record: HistoryRecord | undefined): DecisionPresentation | null {
  const source = record?.params?.sourceEntryId;
  const display = record?.params?.displayEntryId;
  return record?.kind === 'decision' && record.template === 'decision.card' && typeof source === 'string' && typeof display === 'string' && linked(source, display)
    ? { sourceEntryId: source, displayEntryId: display } : null;
}

/** The clicked view supplies its identity. Invalid metadata is ignored, never a reason to change command effects. */
export function answerPresentationParams(before: GameState, after: GameState,
  command: Readonly<Record<string, unknown>>): HistoryParams {
  if (typeof command.displayEntryId !== 'string' || before === after) return {};
  let source: string | undefined;
  if (command.type === 'answer_registry_offer') {
    const old = before.registry?.occurrences.find(item => item.id === command.occurrenceId);
    const settled = after.registry?.occurrences.find(item => item.id === command.occurrenceId);
    if (old?.source === 'v4' && old.status === 'offered' && settled?.status === 'answered'
      && settled.entryId === old.entryId && settled.choiceId === command.choiceId && settled.decidedBy !== 'steward') source = old.entryId;
  } else if (command.type === 'answer_estate_petition') {
    const old = before.stewardship?.petitions.find(item => item.id === command.petitionId);
    const settled = after.stewardship?.petitions.find(item => item.id === command.petitionId);
    if (old?.estateId === HOME_ESTATE_ID && old.status === 'open' && typeof command.grant === 'boolean'
      && settled?.status === (command.grant ? 'granted' : 'refused') && settled.decidedBy === 'lord'
      && settled.kind === old.kind && settled.estateId === old.estateId) source = `home:${old.kind}`;
  }
  return source !== undefined && linked(source, command.displayEntryId)
    ? { sourceEntryId: source, displayEntryId: command.displayEntryId } : {};
}
