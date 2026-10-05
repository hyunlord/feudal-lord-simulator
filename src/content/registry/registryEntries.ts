/**
 * LM-E9 (ER-1): every registry entry as data, with no engine imports — the history ledger and the lord bot read an
 * entry's choices from here (engine/registry.ts validates and loads the same list; a module cycle through the engine
 * would leave constants uninitialised at load).
 */
import { HOME_PETITION_ENTRIES } from "./homePetitions";
import type { RegistryEntry } from "./registryTypes";

/** LM-E9b (ER-13): the content drafts are now the canon v4 (engine/registryV4.ts); LM-E9's eleven drafts left this list. */
export const ALL_REGISTRY_ENTRIES: readonly RegistryEntry[] = [...HOME_PETITION_ENTRIES];

const BY_ID: ReadonlyMap<string, RegistryEntry> = new Map(ALL_REGISTRY_ENTRIES.map(entry => [entry.id, entry]));

export function registryEntryData(id: string): RegistryEntry | undefined {
  return BY_ID.get(id);
}
