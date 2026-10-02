/** LM-E9 (ER-1): the registry entries' words — titles, bodies and choice labels (the imported drafts'; docs/design/glossary.md). */

export interface RegistryEntryCopy {
  readonly title: string;
  readonly body: string;
  readonly choices: Readonly<Record<string, { readonly label: string; readonly ledger: string }>>;
}

/** The imported drafts' words, by entry id (filled from content drafts v2, ER-10). */
export const REGISTRY_COPY: Readonly<Record<string, RegistryEntryCopy>> = {};

export const REGISTRY_TERM_WORDS: Readonly<Record<string, string>> = {
  remission: "감면", installments: "분할 납부", market_dues: "좌판세",
};

export function registryTitle(entryId: string): string {
  return REGISTRY_COPY[entryId]?.title ?? "등록기 사건";
}

export function registryChoiceLedger(entryId: string, choiceId: string): string {
  return REGISTRY_COPY[entryId]?.choices[choiceId]?.ledger ?? "답했다";
}
