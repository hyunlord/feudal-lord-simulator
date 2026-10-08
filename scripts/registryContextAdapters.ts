import { handlesPetitionContext, PETITION_CONTEXT_FILTERS, PETITION_CONTEXT_KEYS } from "../src/content/registry/petitionContextConfig";

export interface ContextAdaptableEntry {
  readonly id: string;
  readonly unsupportedFilters: readonly { readonly id: string }[];
  readonly recurrence?: { readonly contextFields?: readonly string[] };
  readonly dedup?: { readonly semanticFields?: readonly string[] };
}

const boundContextPath = (field: string): string => field.startsWith("authoredContext.") ? `bound.${field}` : field;

const CHAPTER_PETITION_FILTERS: Readonly<Record<string, readonly string[]>> = {
  ck_evt_057: ['church_near_market', 'new_petition_definition_057'],
  ck_evt_058: ['new_petition_definition_058'],
};

export function withChapterPetitionAdapter<Entry extends ContextAdaptableEntry>(entry: Entry) {
  const filters = CHAPTER_PETITION_FILTERS[entry.id];
  if (filters === undefined) return entry;
  return {
    ...entry,
    unsupportedFilters: entry.unsupportedFilters.filter(filter => !filters.includes(filter.id)),
    recurrence: { ...entry.recurrence, contextFields: ['bound.chapterPetition.id'] },
    dedup: { ...entry.dedup, semanticFields: ['bound.chapterPetition.id'] },
  };
}

export function withPetitionContextAdapter<Entry extends ContextAdaptableEntry>(entry: Entry) {
  if (!handlesPetitionContext(entry.id)) return entry;
  return {
    ...entry,
    unsupportedFilters: entry.unsupportedFilters.filter(filter => filter.id !== (PETITION_CONTEXT_FILTERS[entry.id] ?? `${entry.id}.authored_context`)),
    recurrence: {
      ...entry.recurrence,
      contextFields: PETITION_CONTEXT_KEYS[entry.id] ?? entry.recurrence?.contextFields?.map(boundContextPath),
    },
    dedup: {
      ...entry.dedup,
      semanticFields: PETITION_CONTEXT_KEYS[entry.id] ?? entry.dedup?.semanticFields?.map(boundContextPath),
    },
  };
}
