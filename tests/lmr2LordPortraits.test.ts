import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf } from "../src/engine/estates";
import type { Person } from "../src/engine/persons.types";
import { advanceTick } from "../src/engine/tick";
import { newGameState } from "../src/state/newGame";
import { personRow } from "../src/ui/persons/personModels";
import { ermineIdentity, lordPersonRow, lordPortraitStyle } from "../src/ui/lord/screen/lordPortrait";

// LM-R2 "담비 없는 L3": no lord screen draws an ermine face (pool 3's earl house I101–I103, lineage L6) on the lord or
// any gentry — only the earl's own house wears it. LMR2_STATES=<dir> also walks the lord2 states (scripts/lmr2States.ts).

const earls = (person: Person) => person.householdId === "faction:overlord";
/** Everyone a lord screen can show: the town's people (the lord's house), the estates' people, the factions' leaders. */
const shown = (state: GameState): readonly Person[] => [...(state.persons?.people ?? []), ...estatesOf(state).people, ...(state.factions?.people ?? [])];
function states(): readonly { readonly name: string; readonly state: GameState }[] {
  let slice = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!;
  for (let tick = 0; tick < 300; tick += 1) slice = advanceTick(slice);
  const dir = process.env.LMR2_STATES;
  const lord2 = dir === undefined || !existsSync(dir) ? [] : readdirSync(dir).filter(name => name.endsWith(".json") && name !== "lord2.json")
    .map(name => ({ name, state: JSON.parse(readFileSync(join(dir, name), "utf8")) as GameState }));
  return [{ name: "lord slice, 300 ticks", state: slice }, ...lord2];
}

test("the ermine faces are the earl house's and L6's, nothing else", () => {
  for (const id of ["I101_young", "I102_mature", "I103_old", "I101", "L6_201_child", "L6_201_young"]) assert.ok(ermineIdentity(id), id);
  for (const id of ["L3_101_mature", "I073_old", "I123_mature", "P05", "steward_neutral"]) assert.ok(!ermineIdentity(id), id);
});

test("on real lord-mode states, the game picks no ermine face for the lord, his house or any gentry outside the earl's house", () => {
  for (const { name, state } of states()) {
    const people = shown(state);
    assert.ok(people.length > 0, name);
    const wrong = people.filter(person => !earls(person) && ermineIdentity(personRow(state, person).portraitId))
      .map(person => `${name}: ${person.id} ${person.householdId} ${person.classBand} ${personRow(state, person).portraitId}`);
    assert.deepEqual(wrong, []);
  }
});

test("a lord screen's row withholds an ermine face from anyone outside the earl's house (the name stays)", () => {
  const { state } = states()[0]!;
  const gentry = estatesOf(state).people[0]!;
  const forced = { ...gentry, portraitIdentity: "I101" } as Person;
  const row = lordPersonRow(state, forced);
  assert.ok(ermineIdentity(personRow(state, forced).portraitId), "the town's row would draw the earl's face");
  assert.equal(row.portraitId, null);
  assert.equal(lordPortraitStyle({ ...row, portraitId: null }, 64), null);
  assert.equal(row.name, personRow(state, forced).name);
  const earl = state.factions?.people.find(earls);
  if (earl !== undefined) assert.equal(lordPersonRow(state, earl).portraitId, personRow(state, earl).portraitId, "the earl keeps his own");
});

test("source guard: the lord screens draw people only through lordPortrait.ts", () => {
  const files = readdirSync("src/ui/lord", { recursive: true, encoding: "utf8" }).filter(name => /\.(tsx?)$/.test(name) && !name.endsWith("lordPortrait.ts"));
  const offenders = files.filter(name => /\b(portraitStyle|portraitUrl|personRow|personPortrait|drawnPortraitId)\(|persons\.portrait\(/.test(readFileSync(`src/ui/lord/${name}`, "utf8")));
  assert.deepEqual(offenders, []);
});
