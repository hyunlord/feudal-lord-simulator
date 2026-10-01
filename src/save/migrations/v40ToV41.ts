/**
 * v41 is FIX-12 (item 4, spec `docs/design/history-ledger.md` HL-1a, QA-010): a ledger record names a person by id
 * (`lordId`, `guardianId`, `candidateId`, `heirId`, `mayorId`) and the name is drawn when it is read. A v40 save's
 * records kept the name as text; this step finds each person as far as it can and keeps the id instead:
 * - `legacy.heir_seated`: the record's subject is the heir.
 * - `legacy.mayor_demand`, `legacy.charter_sealed`: the legacy keeps the candidate's and the mayor's id.
 * - `legacy.succession`, `lord.wardship_begun`, `lord.wardship_ended`: the one person (the lord's house first, then the
 *   town, the factions) whose name is that text, its epithet aside (a pair's epithet was re-read in v39).
 * A name no one answers to stays as written (the sentence shows it as before).
 */
import type { GameState } from "../../engine/engine.types";
import type { HistoryRecord } from "../../engine/history.types";
import { personDisplayName } from "../../engine/persons";
import type { Person } from "../../engine/persons.types";
import { EPITHETS_KO, OLD_EPITHETS_KO } from "../../content/personNames.ko";

const NAME_KEYS: Readonly<Record<string, readonly string[]>> = {
  "legacy.succession": ["lord"], "lord.wardship_begun": ["lord", "guardian"], "lord.wardship_ended": ["lord"],
  "legacy.heir_seated": ["heir"], "legacy.mayor_demand": ["candidate"], "legacy.charter_sealed": ["mayor"],
};

/** The epithets a name may begin with (the table's and the old pair words), longest first. */
const EPITHET_WORDS = [...new Set([...Object.values(EPITHETS_KO), ...OLD_EPITHETS_KO])].sort((a, b) => b.length - a.length);

/** The name without its leading epithet (a pair's 큰/작은, the old words, any epithet the table gives). */
function bareName(name: string): string {
  const trimmed = name.trim();
  const epithet = EPITHET_WORDS.find(word => trimmed.startsWith(`${word} `));
  return epithet === undefined ? trimmed : trimmed.slice(epithet.length + 1);
}

export function migrateV40ToV41(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v40 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v40 save has no state");
  const state = envelope.state as GameState;
  const records = state.history?.records;
  if (records === undefined || !records.some(record => record.template in NAME_KEYS)) return { ...envelope, schemaVersion: 41 };
  const house = (person: Person) => person.tags.some(tag => tag.startsWith("lord-house:"));
  const people: readonly Person[] = [...(state.persons?.people ?? []), ...(state.persons?.past ?? []), ...(state.factions?.people ?? [])];
  const byName = (text: string): string | null => {
    const bare = bareName(text);
    const matches = people.filter(person => bareName(personDisplayName(person)) === bare);
    // The narrowest circle naming one person: the lord's house living, the house, the living, everyone.
    const tiers = [matches.filter(person => house(person) && person.alive), matches.filter(house), matches.filter(person => person.alive), matches];
    return tiers.find(tier => tier.length === 1)?.[0]?.id ?? null;
  };
  const migrated = records.map((record): HistoryRecord => {
    const keys = NAME_KEYS[record.template];
    if (keys === undefined || record.params === undefined) return record;
    const params: Record<string, string | number> = { ...record.params };
    for (const key of keys) {
      const text = params[key];
      if (typeof text !== "string") continue;
      const id = text === "" ? "" : record.template === "legacy.heir_seated" && record.subject.type === "person" ? record.subject.id
        : record.template === "legacy.mayor_demand" ? state.legacy?.mayorCandidateId ?? byName(text)
          : record.template === "legacy.charter_sealed" ? state.legacy?.mayorId ?? byName(text) : byName(text);
      if (id === null || id === undefined) continue;
      params[`${key}Id`] = id;
      delete params[key];
    }
    return { ...record, params };
  });
  return { ...envelope, schemaVersion: 41, state: { ...state, history: { ...state.history!, records: migrated } } };
}
