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

/**
 * A delta release: its events and, unless it only rewrites existing events' words (`registry` absent — a sender or a
 * text fix, the conditions and choices untouched), its registry entries.
 */
export interface CanonDelta<Event extends { readonly id: string }, Entry extends { readonly id: string }> {
  readonly events: readonly Event[];
  readonly registry?: { readonly policy: unknown; readonly entries: readonly Entry[] };
  /** DEC-TRACE (v4.2): an events-only delta that rewrites only these fields of each event (the rest kept as merged so far). */
  readonly fields?: readonly string[];
}

/**
 * The canon with each delta merged in order: same id replaced, new id added (the base order kept, new ones after). A
 * delta with a registry must name the same ids in both; an events-only delta may only replace events the canon has
 * (an event added without its registry entry would have no conditions).
 */
export function mergeCanon<Event extends { readonly id: string }, Entry extends { readonly id: string }>(
  base: CanonFiles<Event, Entry>, deltas: readonly CanonDelta<Event, Entry>[]): CanonFiles<Event, Entry> {
  let events = [...base.events];
  let entries = [...base.registry.entries];
  const merge = <T extends { readonly id: string }>(list: T[], changes: readonly T[]): T[] => {
    const out = list.map(item => changes.find(change => change.id === item.id) ?? item);
    for (const change of changes) if (!list.some(item => item.id === change.id)) out.push(change);
    return out;
  };
  for (const delta of deltas) {
    const eventIds = delta.events.map(event => event.id).sort();
    if (delta.registry === undefined) {
      const unknown = eventIds.filter(id => !events.some(event => event.id === id));
      if (unknown.length > 0) throw new Error(`an events-only delta may only replace events: ${unknown.join(",")} are new`);
      const fields = delta.fields;
      events = fields === undefined ? merge(events, delta.events) : events.map(event => {
        const change = delta.events.find(entry => entry.id === event.id) as Readonly<Record<string, unknown>> | undefined;
        return change === undefined ? event : { ...event, ...Object.fromEntries(fields.filter(field => field in change).map(field => [field, change[field]])) } as Event;
      });
      continue;
    }
    const entryIds = delta.registry.entries.map(entry => entry.id).sort();
    if (JSON.stringify(eventIds) !== JSON.stringify(entryIds)) throw new Error(`delta events and registry name different ids: ${eventIds.join(",")} / ${entryIds.join(",")}`);
    events = merge(events, delta.events);
    entries = merge(entries, delta.registry.entries);
  }
  return { events, registry: { ...base.registry, entries } };
}

const DRAFTS = resolve(import.meta.dirname, "../docs/design/content-drafts-20261002");
/**
 * The canon releases in order (v4, then its deltas). v4.2 (the audit of the 86 active events: 30 revised — five
 * commands and 25 cards' words) replaces its 30 ids. v4.1-senders rewrites three events' senders only (008 → the church,
 * 024·035 → the town community: one faction each, so their holds can cost a relation, ER-19); no registry file. It is
 * applied last and to the sender field alone: v4.2's 024 and 035 were written before it and carry the old senders,
 * while their words are v4.2's.
 */
export const CANON_RELEASES: readonly { readonly dir: string; readonly events: string; readonly registry?: string; readonly fields?: readonly string[] }[] = [
  { dir: "v4", events: "events-v4.json", registry: "registry-v4.json" },
  { dir: "v4.1", events: "events-v4.1.json", registry: "registry-v4.1.json" },
  { dir: "v4.2", events: "events-v4.2.json", registry: "registry-v4.2.json" },
  { dir: "v4.1-senders", events: "events-v4.1.json", fields: ["sender"] },
];

/** The merged canon read from the repository's content drafts. */
export function readCanon<Event extends { readonly id: string }, Entry extends { readonly id: string }>(): CanonFiles<Event, Entry> {
  const [base, ...deltas] = CANON_RELEASES.map(release => ({
    events: JSON.parse(readFileSync(resolve(DRAFTS, release.dir, release.events), "utf8")) as Event[],
    ...(release.registry === undefined ? {} : { registry: JSON.parse(readFileSync(resolve(DRAFTS, release.dir, release.registry), "utf8")) as { policy: unknown; entries: Entry[] } }),
    ...(release.fields === undefined ? {} : { fields: release.fields }),
  }));
  return mergeCanon(base as CanonFiles<Event, Entry>, deltas);
}
