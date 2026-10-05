import { registryV4Support } from "../engine/registryV4";

// EVENT-ART: which of the 200 confirmed event pictures (assets-inbox/event-art/final200-20261004, file name = the content
// canon v4 event id) the build ships: those of the entries the registry can offer as the event card. No manifest or
// browser import here: the build (scripts/keyartDerivatives.ts) and the install script (scripts/installEventArt.ts) read
// the same selection as the card (src/ui/eventArt.ts).

/**
 * The registry entries that come as the event card: the canon v4 entries the registry runs (ER-17/ER-18,
 * `registryV4Support`: drawn as a season's offer). The canon's variants of an existing occurrence's words and the entries
 * it blocks make no offer; the home petitions (ER-5) have their own cards and Wave 44 pictures (LM-R1).
 */
export const eventCardEntryIds = (): readonly string[] => registryV4Support().filter(entry => entry.runs).map(entry => entry.id);

/**
 * The pictures the build ships: one per entry that can come as the card and has a picture, sorted (EVA-D1). An entry the
 * registry turns on later ships its picture by this alone (no hand list); the rest of the 200 stay in assets-inbox.
 */
export function shippedEventArtIds(known: Readonly<Record<string, unknown>>, ids: readonly string[] = eventCardEntryIds()): readonly string[] {
  return [...new Set(ids)].filter(id => Object.hasOwn(known, id)).sort();
}
