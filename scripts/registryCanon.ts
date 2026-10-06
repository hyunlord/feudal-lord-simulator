// LM-E9b (spec docs/design/registry.md ER-13): the content canon as v4 with its delta releases merged by id — a delta's
// event (events-v4.x.json) and its registry entry (registry-v4.x.json) replace the same id in v4 or are added after it.
// The events and the registry entries of a delta are applied together: a delta whose two lists name different ids is
// refused (applying one without the other would leave an event without its conditions, or the reverse).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface CanonFiles<Event extends { readonly id: string }, Entry extends { readonly id: string }> {
  readonly events: readonly Event[];
  readonly registry: { readonly policy: unknown; readonly entries: readonly Entry[] };
}

/** The canon with each delta merged in order: same id replaced, new id added (the base order kept, new ones after). */
export function mergeCanon<Event extends { readonly id: string }, Entry extends { readonly id: string }>(
  base: CanonFiles<Event, Entry>, deltas: readonly CanonFiles<Event, Entry>[]): CanonFiles<Event, Entry> {
  let events = [...base.events];
  let entries = [...base.registry.entries];
  for (const delta of deltas) {
    const eventIds = delta.events.map(event => event.id).sort();
    const entryIds = delta.registry.entries.map(entry => entry.id).sort();
    if (JSON.stringify(eventIds) !== JSON.stringify(entryIds)) throw new Error(`delta events and registry name different ids: ${eventIds.join(",")} / ${entryIds.join(",")}`);
    const merge = <T extends { readonly id: string }>(list: T[], changes: readonly T[]): T[] => {
      const out = list.map(item => changes.find(change => change.id === item.id) ?? item);
      for (const change of changes) if (!list.some(item => item.id === change.id)) out.push(change);
      return out;
    };
    events = merge(events, delta.events);
    entries = merge(entries, delta.registry.entries);
  }
  return { events, registry: { ...base.registry, entries } };
}

const DRAFTS = resolve(import.meta.dirname, "../docs/design/content-drafts-20261002");
/** The canon releases in order (v4, then its deltas). */
export const CANON_RELEASES = [{ dir: "v4", events: "events-v4.json", registry: "registry-v4.json" },
  { dir: "v4.1", events: "events-v4.1.json", registry: "registry-v4.1.json" }] as const;

/** The merged canon read from the repository's content drafts. */
export function readCanon<Event extends { readonly id: string }, Entry extends { readonly id: string }>(): CanonFiles<Event, Entry> {
  const [base, ...deltas] = CANON_RELEASES.map(release => ({
    events: JSON.parse(readFileSync(resolve(DRAFTS, release.dir, release.events), "utf8")) as Event[],
    registry: JSON.parse(readFileSync(resolve(DRAFTS, release.dir, release.registry), "utf8")) as { policy: unknown; entries: Entry[] },
  }));
  return mergeCanon(base!, deltas);
}
