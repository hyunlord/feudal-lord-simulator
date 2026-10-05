import { ALL_REGISTRY_ENTRIES } from "../content/registry/registryEntries";
import type { RegistryEntry } from "../content/registry/registryTypes";

// EVENT-ART: which of the 200 confirmed event pictures (assets-inbox/event-art/final200-20261004, file name = the content
// canon v4 event id) a registry entry shows, and which the build ships. No manifest or browser import here: the build
// (scripts/keyartDerivatives.ts) and the install script (scripts/installEventArt.ts) read the same selection as the card.

/** The picture's key for an entry: the engine's `artId` when it sets one, else the entry's own id (canon v4 ids). */
export const eventArtKey = (entry: Pick<RegistryEntry, "id" | "artId">): string => entry.artId ?? entry.id;

/** The home petitions (ER-5, `generator: "home_cycle"`) have their own cards and Wave 44 pictures (LM-R1), never these. */
const hasEventCard = (entry: Pick<RegistryEntry, "generator">): boolean => entry.generator === undefined;

/**
 * The pictures the build ships: one per registry entry with an event card whose key has a picture, sorted. An entry the
 * engine adds later ships its picture by this alone (no hand list); the 200 not in the registry stay in assets-inbox.
 */
export function shippedEventArtIds(known: Readonly<Record<string, unknown>>, entries: readonly RegistryEntry[] = ALL_REGISTRY_ENTRIES): readonly string[] {
  const keys = new Set(entries.filter(hasEventCard).map(eventArtKey).filter(key => Object.hasOwn(known, key)));
  return [...keys].sort();
}
