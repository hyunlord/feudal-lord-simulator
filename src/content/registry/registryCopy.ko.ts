/** LM-E9 (ER-1): the registry entries' words — titles, bodies and choice labels (the imported drafts'; docs/design/glossary.md). */

import { V4_COPY } from "./v4Copy.generated";

export interface RegistryEntryCopy {
  readonly title: string;
  readonly body: string;
  readonly choices: Readonly<Record<string, { readonly label: string; readonly ledger: string }>>;
}

/** LM-E9 entries' own words by id (the canon v4's are in v4Copy.generated.ts; LM-E9's eleven drafts moved there, ER-13). */
export const REGISTRY_COPY: Readonly<Record<string, RegistryEntryCopy>> = {};

export const REGISTRY_TERM_WORDS: Readonly<Record<string, string>> = {
  remission: "감면", installments: "분할 납부", market_dues: "좌판세",
};

export function registryTitle(entryId: string): string {
  return V4_COPY[entryId]?.title ?? REGISTRY_COPY[entryId]?.title ?? "등록기 사건";
}

export function registryChoiceLedger(entryId: string, choiceId: string): string {
  const v4 = V4_COPY[entryId]?.choices[choiceId];
  return v4?.ledger ?? v4?.label ?? REGISTRY_COPY[entryId]?.choices[choiceId]?.ledger ?? "답했다";
}
