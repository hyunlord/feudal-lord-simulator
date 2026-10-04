/**
 * LM-E9 (ER-1): every registry entry as data, with no engine imports — the history ledger and the lord bot read an
 * entry's choices from here (engine/registry.ts validates and loads the same list; a module cycle through the engine
 * would leave constants uninitialised at load).
 */
import { DRAFT_EVENT_ENTRIES } from "./draftEvents";
import { HOME_PETITION_ENTRIES } from "./homePetitions";
import type { RegistryEntry } from "./registryTypes";

export const ALL_REGISTRY_ENTRIES: readonly RegistryEntry[] = [...HOME_PETITION_ENTRIES, ...DRAFT_EVENT_ENTRIES];

const BY_ID: ReadonlyMap<string, RegistryEntry> = new Map(ALL_REGISTRY_ENTRIES.map(entry => [entry.id, entry]));

export function registryEntryData(id: string): RegistryEntry | undefined {
  return BY_ID.get(id);
}
