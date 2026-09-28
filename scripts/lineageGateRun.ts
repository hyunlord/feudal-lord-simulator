// PERSON-1a gate (spec docs/design/lineage.md): the bot from a seed's growth opening through chapters 1–2 (to chapter 3's
// start or `maxTicks`), then: of the children born in town, how many have a parent's hair (both parents known, and one);
// how many of the lineage-set families' living people wear their set's faces; and how many of each passing state the
// ledger wrote.
//   tsx scripts/lineageGateRun.ts <seed> <maxTicks> > seed.json
import { FACTION_LINEAGE_SETS } from "../src/content/factionConfig";
import type { GameState } from "../src/engine/engine.types";
import { LORD_FAMILY_TAG } from "../src/engine/persons";
import type { Person } from "../src/engine/persons.types";
import { identityFaction, identityLineage } from "../src/engine/portraits";
import { stateCalendar } from "../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 220_000);
const STATES = ["person.fell_ill", "person.recovered", "person.injured", "person.healed", "person.expecting", "person.pilgrimage", "person.returned", "person.bailiff"];
let last: GameState | null = null;
const counts: Record<string, number> = Object.fromEntries(STATES.map(template => [template, 0]));
let counted = 0;
runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, onTick: state => {
  last = state;
  // The ledger keeps everyday records a while only: count each state's line once, by its ordinal (`h-000123`), as written.
  for (const record of state.history?.records ?? []) {
    const ordinal = Number(record.id.slice(2));
    if (ordinal <= counted) continue;
    if (record.template in counts) counts[record.template]! += 1;
  }
  counted = (state.history?.nextOrdinal ?? 1) - 1;
}, additionalAcceptance: state => (state.politics?.chapter.number ?? 1) >= 3 });
const final = last as unknown as GameState;
const everyone: readonly Person[] = [...final.persons!.people, ...final.persons!.past, ...(final.factions?.people ?? [])];
const byId = new Map(everyone.map(person => [person.id, person]));
const born = everyone.filter(person => person.motherId !== undefined || person.fatherId !== undefined);
const both = born.filter(person => person.motherId !== undefined && person.fatherId !== undefined && byId.has(person.motherId) && byId.has(person.fatherId));
const hairOf = (id: string | undefined) => (id === undefined ? undefined : byId.get(id)?.traits.hair);
const matches = (group: readonly Person[]) => group.filter(person => person.traits.hair === hairOf(person.motherId) || person.traits.hair === hairOf(person.fatherId)).length;
// The set families: the lord's family, the town's named lineages with a set (and those married into their households),
// and the noble factions' people with a set.
const sets = new Map((final.persons!.lineages ?? []).filter(lineage => lineage.set !== null).map(lineage => [lineage.id, lineage.set!]));
const living = final.persons!.people;
const householdsOf = new Map<string, string>();
for (const person of living) if (sets.has(person.lineageId) && (person.role === "head" || person.role === "spouse")) householdsOf.set(person.householdId, sets.get(person.lineageId)!);
const family = living.filter(person => sets.has(person.lineageId) || ((person.role === "head" || person.role === "spouse") && householdsOf.has(person.householdId)
  && (person.householdId !== "manor" || person.tags.includes(LORD_FAMILY_TAG))))
  .map(person => ({ person, set: sets.get(person.lineageId) ?? householdsOf.get(person.householdId)! }));
const factionFamily = (final.factions?.people ?? []).filter(person => person.alive).flatMap(person => {
  const faction = person.householdId.slice("faction:".length) as keyof typeof FACTION_LINEAGE_SETS;
  const set = FACTION_LINEAGE_SETS[faction];
  return set === undefined ? [] : [{ person, set }];
});
const wearsSet = (entry: { person: Person; set: string }) => identityLineage(entry.person.portraitIdentity) === entry.set
  // L6 and L7's founders are pool 3's earl and knight (the set's first generation).
  || (entry.set === "L6" && identityFaction(entry.person.portraitIdentity) === "earl_house") || (entry.set === "L7" && identityFaction(entry.person.portraitIdentity) === "neighbor_a");
const setPeople = [...family, ...factionFamily];
process.stdout.write(`${JSON.stringify({ seed, maxTicks, final: { tick: final.tick, year: stateCalendar(final).year, chapter: final.politics?.chapter.number ?? 1, population: final.population },
  hair: { bornWithParents: born.length, bothParents: both.length, bothMatch: matches(both), bothRate: both.length === 0 ? null : matches(both) / both.length,
    anyParentMatch: matches(born), anyRate: born.length === 0 ? null : matches(born) / born.length },
  sets: { namedLineages: (final.persons!.lineages ?? []).map(lineage => ({ id: lineage.id, kind: lineage.kind, set: lineage.set, places: Object.keys(lineage.slots).length })),
    people: setPeople.length, wearingSet: setPeople.filter(wearsSet).length, rate: setPeople.length === 0 ? null : setPeople.filter(wearsSet).length / setPeople.length,
    notWearing: setPeople.filter(entry => !wearsSet(entry)).map(entry => `${entry.person.id}:${entry.set}:${entry.person.portraitIdentity}:${entry.person.birthYear}`).slice(0, 20) },
  ledgerStates: counts }, null, 1)}\n`);
