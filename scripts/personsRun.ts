// PERSON-0 gates ② ③ (spec docs/design/persons.md PS-1…PS-9): runs the bot on a seed to the end of chapter 1 and checks
// the persons against the population every season — the living in houses equal the population, names are unique
// among the living, portraits match exactly (sex, age band, class) — and counts births, arrivals, deaths by cause and
// departures, which must add up to the population's change. Also the steward, the reeve and the petitioners.
//   tsx scripts/personsRun.ts <seed> <maxTicks> [out.json]
import { writeFileSync } from "node:fs";
import type { GameState } from "../src/engine/engine.types";
import { ageBandOf, ageOf, currentYear, displayName, personPortrait, personsByRole } from "../src/engine/persons";
import { MANOR_HOUSEHOLD } from "../src/engine/persons.types";
import { chapterEnd } from "../src/engine/politics";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg, outArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 100_000);
const counts = { born: 0, married: 0, founded: 0, arrived: 0, died: {} as Record<string, number>, left: 0 };
const samples: { tick: number; population: number; living: number; adults: number; children: number; elders: number }[] = [];
let invariantBreaks = 0;
let startLiving: number | null = null;
let duplicateNames = 0;
let portraitChecks = 0;
let portraitExact = 0;
const misses: Record<string, number> = {};
let previous: GameState | null = null;
let last: GameState | null = null;
let endTick: number | null = null;
runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, additionalAcceptance: () => false, onTick: state => {
  const before = previous?.persons;
  const after = state.persons;
  if (before !== undefined && startLiving === null) startLiving = before.people.length;
  if (before !== undefined && after !== undefined && before !== after) {
    const known = new Set(before.people.map(person => person.id));
    for (const person of after.people) {
      if (known.has(person.id)) continue;
      if (person.role === "child" && person.birthYear === currentYear(state)) counts.born += 1;
      else if (person.role === "spouse") counts.married += 1;
      else if (person.role === "head") counts.founded += 1;
      else if (person.role === "kin" || person.role === "child") counts.arrived += 1;
    }
    for (const person of after.past.slice(before.past.length)) {
      if (!person.alive) counts.died[person.deathCause ?? "age"] = (counts.died[person.deathCause ?? "age"] ?? 0) + 1;
      else counts.left += 1;
    }
  }
  if (after !== undefined && state.tick % 1_000 === 0) {
    const living = after.people.filter(person => person.householdId !== MANOR_HOUSEHOLD);
    if (living.length !== state.population) invariantBreaks += 1;
    const names = after.people.map(displayName);
    duplicateNames += names.length - new Set(names).size;
    const year = currentYear(state);
    for (const person of after.people) {
      const portrait = personPortrait(state, person);
      portraitChecks += 1;
      if (portrait.exact) portraitExact += 1;
      else { const key = `${person.sex}/${ageBandOf(ageOf(person, year))}/${person.classBand}`; misses[key] = (misses[key] ?? 0) + 1; }
    }
    samples.push({ tick: state.tick, population: state.population, living: living.length,
      adults: living.filter(person => ageOf(person, year) >= 14).length, children: living.filter(person => ageOf(person, year) < 14).length,
      elders: living.filter(person => ageOf(person, year) >= 55).length });
  }
  if (endTick === null && chapterEnd(state) !== null) endTick = state.tick;
  previous = state;
  last = state;
} });
const final = last as GameState | null;
if (final === null || final.persons === undefined) throw new Error("no persons");
const first = samples[0]!;
const end = samples.at(-1)!;
const deaths = Object.values(counts.died).reduce((sum, value) => sum + value, 0);
const year = currentYear(final);
const result = {
  seed, maxTicks, finalTick: final.tick, chapterEndTick: endTick,
  population: { first: first.population, end: end.population, living: end.living },
  invariantBreaks, duplicateNames,
  portraits: { checks: portraitChecks, exact: portraitExact, share: portraitChecks === 0 ? null : portraitExact / portraitChecks, misses },
  counts, deaths,
  // New persons − those who died or left = the change of the living (from the first tick with persons).
  accounting: { startLiving, endLiving: final.persons.people.length, added: counts.born + counts.married + counts.founded + counts.arrived, gone: deaths + counts.left,
    balanced: startLiving !== null && final.persons.people.length - startLiving === counts.born + counts.married + counts.founded + counts.arrived - deaths - counts.left },
  ageBands: { adults: end.adults, children: end.children, elders: end.elders },
  offices: {
    steward: personsByRole(final, "steward").map(displayName),
    reeve: personsByRole(final, "reeve").map(displayName),
    masters: personsByRole(final, "manager").length,
    petitions: (final.politics?.petitions ?? []).map(petition => ({ id: petition.id, petitioners: (petition.petitionerIds ?? []).map(id => {
      const person = [...final.persons!.people, ...final.persons!.past].find(entry => entry.id === id);
      return person === undefined ? id : `${displayName(person)} (${person.occupation}, ${ageOf(person, year)})`;
    }) })),
  },
  past: final.persons.past.length, living: final.persons.people.length,
  samples: samples.filter((_, index) => index % 4 === 0),
};
if (outArg !== undefined) writeFileSync(outArg, `${JSON.stringify(result, null, 1)}\n`);
process.stdout.write(`${JSON.stringify({ ...result, samples: undefined })}\n`);
