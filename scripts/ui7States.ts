// UI-7 gates' states: the v24 palisade-construction town (chapter 2 as it is saved) left to run, no state edited. Written
// as GameState JSON (the format scripts/renderCommitProbe.mjs openScene takes) with moments.json:
//   lord      — once the ruling house's family has formed in the manor (LN-9; the L3 lineage set);
//   baby      — the first child born in town under two (PERSON-1a: a face from the pool or the lineage set);
//   sick, injury, pregnant, pilgrim — the first tick someone in town has that condition (LN-10 `persons.condition`);
//   bailiff   — the first tick a bailiff holds the office (tag `bailiff`).
// Each moment names the person, their household's building and whether the ledger holds the record the chronicle shows.
//   npx tsx scripts/ui7States.ts <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { persons } from "../src/engine/personsApi";
import { ageOf, currentYear } from "../src/engine/persons";
import type { Person } from "../src/engine/persons.types";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";

const [out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
let state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v24/palisade-construction.save.json"))).envelope.state as GameState;
const RECORDS: Readonly<Record<string, string>> = { sick: "person.fell_ill", injury: "person.injured", pregnant: "person.expecting", pilgrim: "person.pilgrimage", bailiff: "person.bailiff" };
const moments: Record<string, Record<string, unknown>> = {};
const inHouse = (person: Person) => state.buildings.some(building => building.id === person.householdId);
const write = (name: string, person: Person) => {
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  const template = RECORDS[name];
  const recorded = template === undefined ? null : (state.history?.records ?? []).some(record => record.template === template && record.subject.id === person.id);
  const building = state.buildings.find(entry => entry.id === person.householdId);
  moments[name] = { tick: state.tick, person: person.id, household: person.householdId, house: building === undefined ? null : [building.tx, building.ty], recorded };
  console.log(name, state.tick, JSON.stringify(moments[name]));
};
const CHECKS: readonly [string, () => Person | undefined][] = [
  ["lord", () => state.persons?.people.filter(person => person.tags.includes("lord-family")).find(person => person.role === "head")],
  ["baby", () => state.persons?.people.find(person => inHouse(person) && person.motherId !== undefined && ageOf(person, currentYear(state)) < 2)],
  ...(["sick", "injury", "pregnant", "pilgrim"] as const).map(kind => [kind, () => state.persons?.people.find(person => inHouse(person) && persons.condition(state, person)?.kind === kind)] as const),
  ["bailiff", () => state.persons?.people.find(person => inHouse(person) && person.tags.includes("bailiff"))],
];
for (let step = 0; step < 20_000 && Object.keys(moments).length < CHECKS.length; step += 1) {
  state = advanceTick(state);
  for (const [name, find] of CHECKS) {
    if (moments[name] !== undefined) continue;
    const person = find();
    if (person !== undefined) write(name, person);
  }
}
writeFileSync(join(out!, "moments.json"), JSON.stringify(moments, null, 1) + "\n");
const missing = CHECKS.map(([name]) => name).filter(name => moments[name] === undefined);
console.log(JSON.stringify({ moments: Object.keys(moments).length, missing }));
process.exitCode = missing.length === 0 ? 0 : 1;
