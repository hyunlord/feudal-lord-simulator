import { handlesPetitionContext } from "../src/content/registry/petitionContextConfig";

export interface ContextAdaptableEntry {
  readonly id: string;
  readonly unsupportedFilters: readonly { readonly id: string }[];
  readonly recurrence?: { readonly contextFields?: readonly string[] };
  readonly dedup?: { readonly semanticFields?: readonly string[] };
}

const boundContextPath = (field: string): string => field.startsWith("authoredContext.") ? `bound.${field}` : field;

export function withPetitionContextAdapter<Entry extends ContextAdaptableEntry>(entry: Entry) {
  if (!handlesPetitionContext(entry.id)) return entry;
  return {
    ...entry,
    unsupportedFilters: entry.unsupportedFilters.filter(filter => filter.id !== `${entry.id}.authored_context`),
    recurrence: {
      ...entry.recurrence,
      contextFields: entry.recurrence?.contextFields?.map(boundContextPath),
    },
    dedup: {
      ...entry.dedup,
      semanticFields: entry.dedup?.semanticFields?.map(boundContextPath),
    },
  };
}
